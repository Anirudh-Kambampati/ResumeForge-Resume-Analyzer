"""Stage 5: Import Orchestration — coordinates the full resume parsing pipeline.

Pipeline stages:
  1. EXTRACT  →  extractor.extract_text_from_pdf()
  2. PROMPT   →  prompt_builder.build_parse_prompts()
  3. LLM      →  llm_client.chat_completion()
  4. VALIDATE →  validator.clean_and_parse_json() + validate_parsed_structure()
  5. REPAIR   →  (conditional) llm_client.chat_completion() with repair prompts

Key design constraints:
  - NEVER adds builder UI concerns (sectionOrder, template, layout)
  - Stage-level logging so every failure is traceable
  - Returns pure resume data — frontend decides how to map into builder format
"""

import logging
import time
from typing import Any, Dict, Optional

from fastapi import HTTPException

from services.extractor import extract_text_from_pdf, ExtractionResult
from services.llm_client import LLMClient
from services.prompt_builder import build_parse_prompts, build_repair_prompt
from services.validator import (
    clean_and_parse_json,
    sanitize_parsed_resume,
    validate_parsed_structure,
)

logger = logging.getLogger("resumeforge.pipeline.import_service")


class ImportResult:
    """Result of the full import pipeline."""

    def __init__(
        self,
        parsed_data: Dict[str, Any],
        extraction_meta: Optional[Dict[str, Any]] = None,
        repair_attempted: bool = False,
        stage_timings: Optional[Dict[str, float]] = None,
        issues: Optional[list[str]] = None,
    ) -> None:
        self.parsed_data = parsed_data
        self.extraction_meta = extraction_meta or {}
        self.repair_attempted = repair_attempted
        self.stage_timings = stage_timings or {}
        self.issues = issues or []

    def to_response_dict(self) -> Dict[str, Any]:
        """Convert to API response dict (without builder concerns)."""
        return {
            **self.parsed_data,
        }


async def run_import_pipeline(
    pdf_bytes: bytes,
    filename: str = "resume.pdf",
    llm_client: Optional[LLMClient] = None,
    max_retries: int = 1,
) -> ImportResult:
    """Execute the full resume import pipeline from PDF bytes to structured data.

    Args:
        pdf_bytes: Raw PDF file content.
        filename: Original filename (for logging context).
        llm_client: Configured LLMClient instance. If None, pipeline fails fast.
        max_retries: Number of times to retry LLM generation on validation failure.

    Returns:
        ImportResult with parsed resume data and stage metadata.

    Raises:
        HTTPException: With stage-specific error detail on any pipeline failure.
    """
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="AI service is not configured. Cannot parse resume.",
        )

    pipeline_start = time.perf_counter()
    logger.info(
        "[PIPELINE] Starting resume import | file=%s | size_bytes=%d",
        filename,
        len(pdf_bytes),
    )

    stage_timings: Dict[str, float] = {}
    all_issues: list[str] = []
    repair_attempted = False

    # ================================================================
    # Stage 1: Text Extraction
    # ================================================================
    stage_start = time.perf_counter()
    try:
        extraction: ExtractionResult = extract_text_from_pdf(pdf_bytes, filename)
    except ValueError as exc:
        logger.error("[PIPELINE] STAGE 1 (EXTRACT) FAILED | error=%s", str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stage_timings["extract"] = time.perf_counter() - stage_start

    if extraction.is_empty():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from the PDF. "
            "The file may be scanned or image-based. "
            "Please upload a text-based PDF.",
        )

    # ================================================================
    # Stage 2: Prompt Construction
    # ================================================================
    stage_start = time.perf_counter()
    prompts = build_parse_prompts(extraction.text)
    stage_timings["prompt"] = time.perf_counter() - stage_start

    # ================================================================
    # Stage 3: LLM Interaction (with optional repair retry)
    # ================================================================
    raw_llm_output: str = ""
    parsed_data: Dict[str, Any] = {}

    for attempt in range(max_retries + 1):
        stage_start = time.perf_counter()

        if attempt == 0:
            logger.info("[PIPELINE] STAGE 3 (LLM) — initial request | attempt=%d", attempt + 1)
            try:
                raw_llm_output = await llm_client.chat_completion(
                    prompts["system"],
                    prompts["user"],
                )
            except HTTPException:
                raise  # Pass through HTTP exceptions from the LLM client

        else:
            # Repair retry
            logger.warning(
                "[PIPELINE] STAGE 3 (LLM) — repair retry | attempt=%d",
                attempt + 1,
            )
            repair_prompts = build_repair_prompt(raw_llm_output, str(parse_error or "Unknown error"))
            try:
                raw_llm_output = await llm_client.chat_completion(
                    repair_prompts["system"],
                    repair_prompts["user"],
                )
            except HTTPException:
                raise

            repair_attempted = True

        stage_timings[f"llm_{attempt}"] = time.perf_counter() - stage_start

        # ================================================================
        # Stage 4: Validation
        # ================================================================
        stage_start = time.perf_counter()

        try:
            parsed_data = clean_and_parse_json(raw_llm_output)
            parse_error = None
        except ValueError as exc:
            parse_error = exc
            logger.error(
                "[PIPELINE] STAGE 4 (VALIDATE) JSON parse failed | attempt=%d | error=%s",
                attempt + 1,
                str(exc),
            )
            if attempt < max_retries:
                continue  # Try repair
            raise HTTPException(
                status_code=502,
                detail=f"The AI model failed to output valid structured data: {exc}",
            ) from exc

        # Validate structure
        structure_issues = validate_parsed_structure(parsed_data)
        all_issues.extend(structure_issues)

        if structure_issues:
            logger.warning(
                "[PIPELINE] STAGE 4 (VALIDATE) structure issues | attempt=%d | issues=%s",
                attempt + 1,
                structure_issues,
            )
            # Structure issues are non-fatal for now — frontend handles missing fields gracefully
            # But if it's severe (not even a dict), we reject
            if not isinstance(parsed_data, dict) or not parsed_data:
                if attempt < max_retries:
                    parse_error = ValueError(f"Invalid structure: {structure_issues}")
                    continue
                raise HTTPException(
                    status_code=502,
                    detail="The AI model returned an invalid resume structure.",
                )

        # Sanitize — strip any builder UI concerns
        parsed_data = sanitize_parsed_resume(parsed_data)

        stage_timings[f"validate_{attempt}"] = time.perf_counter() - stage_start

        # If we reach here, validation passed — break out of retry loop
        if not parse_error:
            break

    # ================================================================
    # Pipeline Complete
    # ================================================================
    total_elapsed = time.perf_counter() - pipeline_start
    logger.info(
        "[PIPELINE] Completed | file=%s | stages=%s | total=%.2fs | repair=%s | issues=%d",
        filename,
        list(stage_timings.keys()),
        total_elapsed,
        repair_attempted,
        len(all_issues),
    )

    return ImportResult(
        parsed_data=parsed_data,
        extraction_meta={
            "page_count": extraction.page_count,
            "char_count": extraction.char_count,
            "quality_flags": extraction.quality_flags,
        },
        repair_attempted=repair_attempted,
        stage_timings=stage_timings,
        issues=all_issues,
    )
