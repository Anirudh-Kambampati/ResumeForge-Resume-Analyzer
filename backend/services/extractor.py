"""Stage 1: Text Extraction from PDF resumes.

Responsibility:
  - Accept raw PDF bytes
  - Extract text via pypdf
  - Surface extraction quality signals (page count, character count, corruption)
  - NEVER touches LLM, validation, or builder concerns

Stage-level logging:
  - Logs entry with file name / byte size
  - Logs exit with extracted char count and quality indicators
  - Logs warnings on low-quality extraction (empty, garbled, scanned)
"""

import io
import logging
import time
from typing import Dict, Optional

import pypdf

logger = logging.getLogger("resumeforge.pipeline.extractor")


class ExtractionResult:
    """Typed result from the extractor stage."""

    def __init__(
        self,
        text: str,
        page_count: int,
        char_count: int,
        quality_flags: Optional[Dict[str, bool]] = None,
    ) -> None:
        self.text = text
        self.page_count = page_count
        self.char_count = char_count
        self.quality_flags = quality_flags or {}

    def is_empty(self) -> bool:
        return not self.text.strip()

    def has_corruption_warning(self) -> bool:
        return self.quality_flags.get("has_replacement_chars", False) or self.quality_flags.get(
            "high_control_char_ratio", False
        )


def extract_text_from_pdf(
    pdf_bytes: bytes,
    filename: str = "unknown.pdf",
    max_size_bytes: int = 10 * 1024 * 1024,
) -> ExtractionResult:
    """Extract text from raw PDF bytes.

    Args:
        pdf_bytes: Raw PDF file content.
        filename: Original filename for logging context.
        max_size_bytes: Reject files larger than this size.

    Returns:
        ExtractionResult with extracted text and quality metadata.

    Raises:
        ValueError: If the PDF is password-protected, corrupt, or oversized.
    """
    stage_start = time.perf_counter()
    logger.info("[EXTRACT] Starting extraction | file=%s | size_bytes=%d", filename, len(pdf_bytes))

    if not pdf_bytes:
        raise ValueError("PDF file is empty — no bytes to process.")

    if len(pdf_bytes) > max_size_bytes:
        raise ValueError(
            f"PDF file exceeds maximum size of {max_size_bytes // (1024 * 1024)}MB "
            f"(got {len(pdf_bytes)} bytes)."
        )

    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = pypdf.PdfReader(pdf_file)
    except Exception as exc:
        logger.error("[EXTRACT] FAILED — pypdf could not open PDF | file=%s | error=%s", filename, str(exc))
        raise ValueError(
            "Failed to parse PDF document. Ensure it is not password protected or corrupt."
        ) from exc

    page_count = len(reader.pages)
    extracted_text = ""
    quality_flags: Dict[str, bool] = {}

    for i, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
        except Exception as exc:
            logger.warning("[EXTRACT] Page %d extraction failed | file=%s | error=%s", i, filename, str(exc))
            page_text = ""
        extracted_text += page_text

    extracted_text = extracted_text.strip()
    char_count = len(extracted_text)

    # Quality checks
    replacement_count = extracted_text.count("\ufffd")
    control_chars = sum(ord(c) < 32 and c not in "\n\t\r" for c in extracted_text)
    control_ratio = control_chars / max(1, char_count)
    word_count = len([w for w in extracted_text.split() if any(c.isalpha() for c in w)])

    quality_flags["has_replacement_chars"] = replacement_count > char_count * 0.05
    quality_flags["high_control_char_ratio"] = control_ratio > 0.05
    quality_flags["low_word_count"] = word_count < 20 and char_count > 100

    elapsed = time.perf_counter() - stage_start

    if not extracted_text:
        logger.warning(
            "[EXTRACT] Zero text extracted | file=%s | pages=%d | elapsed=%.2fs",
            filename,
            page_count,
            elapsed,
        )
        return ExtractionResult("", page_count, 0, quality_flags)

    logger.info(
        "[EXTRACT] Completed | file=%s | chars=%d | pages=%d | words=%d | "
        "corruption_flags=%s | elapsed=%.2fs",
        filename,
        char_count,
        page_count,
        word_count,
        quality_flags,
        elapsed,
    )

    return ExtractionResult(extracted_text, page_count, char_count, quality_flags)
