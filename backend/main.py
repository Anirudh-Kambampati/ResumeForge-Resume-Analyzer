import os
import logging
from typing import Any, Optional, List, Dict, Tuple
from fastapi import Depends, FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from services.rate_limiter import ai_rate_limit, is_api_key_configured

from services.scoring_service import score_resume, normalize_skill, SKILL_ALIASES
from services.jd_service import calculate_job_match
from services.llm_client import LLMClient
from services.validator import clean_and_parse_json, validate_generated_claims
from services.bullet_evidence import is_safe_rewrite
from services.import_service import run_import_pipeline
from services.extractor import extract_text_from_pdf, ExtractionResult
from services.docx_extractor import extract_text_from_docx, DocxExtractionResult
from services.ats_service import run_ats_optimization

# -------------------------------------------------------------------
# Logging infrastructure — stage-level granularity
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("ResumeForge-Backend")

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="ResumeForge API", version="1.0.0")

# Compress large JSON responses (analyze payloads are tens of KB)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# -------------------------------------------------------------------
# Abuse protection: per-IP rate limits on AI endpoints.
#
# Limits are per-IP sliding windows, enforced before any expensive work
# (PDF parsing, LLM calls). Tune via env vars; defaults suit a free-tier
# OpenRouter key comfortably.
# -------------------------------------------------------------------

_RATE_LIMIT_ANALYZE = int(os.getenv("RATE_LIMIT_ANALYZE", "10"))
_RATE_LIMIT_IMPROVE = int(os.getenv("RATE_LIMIT_IMPROVE", "30"))
_RATE_LIMIT_PARSE = int(os.getenv("RATE_LIMIT_PARSE", "10"))
_RATE_LIMIT_ATS = int(os.getenv("RATE_LIMIT_ATS", "10"))
_RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
_RATE_LIMIT_HEALTH = int(os.getenv("RATE_LIMIT_HEALTH", "30"))

rate_limit_analyze = ai_rate_limit(_RATE_LIMIT_ANALYZE, _RATE_LIMIT_WINDOW)
rate_limit_improve = ai_rate_limit(_RATE_LIMIT_IMPROVE, _RATE_LIMIT_WINDOW)
rate_limit_parse = ai_rate_limit(_RATE_LIMIT_PARSE, _RATE_LIMIT_WINDOW)
rate_limit_ats = ai_rate_limit(_RATE_LIMIT_ATS, _RATE_LIMIT_WINDOW)
rate_limit_health = ai_rate_limit(_RATE_LIMIT_HEALTH, _RATE_LIMIT_WINDOW)

# Max accepted resume file size. Enforced before reading the whole body into memory.
MAX_RESUME_BYTES = 5 * 1024 * 1024

SUPPORTED_RESUME_EXTENSIONS = (".pdf", ".docx")


def _validate_resume_upload(resume: UploadFile, file_bytes: bytes) -> None:
    """Common guards for resume upload endpoints (PDF and DOCX)."""
    if not resume.filename or not resume.filename.lower().endswith(SUPPORTED_RESUME_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Only PDF or DOCX resume uploads are supported.",
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(file_bytes) > MAX_RESUME_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Resume file size must be less than 5MB.",
        )


def _extract_resume_text(
    file_bytes: bytes, filename: str
) -> Tuple[str, List[Dict[str, Any]], int]:
    """Extract text from PDF or DOCX bytes, routing on the extension.

    Returns (text, embedded_links, page_count). Raises HTTPException 400 on
    corrupt / scanned / empty files.
    """
    if filename.lower().endswith(".docx"):
        try:
            result: DocxExtractionResult = extract_text_from_docx(file_bytes, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return result.text, result.embedded_links, result.page_count

    try:
        result: ExtractionResult = extract_text_from_pdf(file_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result.text, result.embedded_links, result.page_count


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://resume-forge-chi-five.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------------
# Shared helpers (model definitions, config)
# -------------------------------------------------------------------


def get_openrouter_config():
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")

    if model.startswith("OPENROUTER_MODEL="):
        model = model[len("OPENROUTER_MODEL=") :].strip()
    else:
        model = model.strip()

    if not api_key or api_key.strip() == "" or "your_openrouter_api_key" in api_key:
        return None, model
    return api_key.strip(), model


class ImproveRequest(BaseModel):
    type: str = Field(pattern="^(summary|bullet|project_bullet|experience_bullet|achievement)$")
    text: str
    context: Optional[str] = None


class JDRequirements(BaseModel):
    target_title: str = ""
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    domain_keywords: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)


# -------------------------------------------------------------------
# Health
# -------------------------------------------------------------------


@app.get("/api/health")
def health_check():
    api_key, model = get_openrouter_config()
    llm = LLMClient.from_env(api_key, model)
    return {
        "status": "healthy",
        "ai_provider_configured": llm is not None,
        "configured_model": llm.model if llm else model,
        "model_chain": llm.model_chain if llm else [],
        "api_key_required": is_api_key_configured(),
        "supported_formats": ["pdf", "docx"],
    }


# -------------------------------------------------------------------
# /api/parse — Import pipeline (extract → prompt → LLM → validate)
# -------------------------------------------------------------------


@app.post("/api/parse")
async def parse_resume_endpoint(
    resume: UploadFile = File(...),
    _: None = Depends(rate_limit_parse),
):
    """Upload a PDF or DOCX resume and receive structured parsed data.

    The pipeline runs through five stages:
      1. EXTRACT  → PDF/DOCX text extraction
      2. PROMPT   → LLM prompt construction
      3. LLM      → OpenRouter chat completion
      4. VALIDATE → JSON parsing and structure validation
      5. ORCHESTRATE → stage coordination and error recovery

    Returns pure resume data (profile, education, experience, skills, etc.)
    without any builder-specific concerns (sectionOrder, template, layout).
    """
    # Read once — a second UploadFile.read() returns b"" (stream is at EOF)
    file_bytes = await resume.read()
    _validate_resume_upload(resume, file_bytes)
    # Check configuration
    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. "
            "Please verify the .env configuration.",
        )

    # Run the pipeline
    result = await run_import_pipeline(
        file_bytes=file_bytes,
        filename=resume.filename,
        llm_client=llm_client,
    )

    return result.to_response_dict()


# -------------------------------------------------------------------
# /api/analyze — Full resume analysis (scoring + AI review + job match)
# -------------------------------------------------------------------


async def _run_ai_review(llm_client: LLMClient, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """Call the LLM for the review JSON, with one JSON-repair retry.

    Raises HTTPException (provider errors) or ValueError (unparseable output);
    the caller degrades to rule-based results on either.
    """
    def parse_object(raw: str) -> Dict[str, Any]:
        parsed = clean_and_parse_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("expected a JSON object")
        return parsed

    raw_response = await llm_client.chat_completion(system_prompt, user_prompt)
    try:
        return parse_object(raw_response)
    except Exception as e:
        logger.warning(f"Initial JSON parsing failed: {str(e)}. Attempting repair retry...")
    repair_system_prompt = "You are a JSON correction assistant. Fix the JSON and return valid JSON only."
    repair_user_prompt = f"""
JSON OUTPUT:
{raw_response}
Correct this to output ONLY valid JSON.
"""
    repaired_response = await llm_client.chat_completion(repair_system_prompt, repair_user_prompt)
    try:
        return parse_object(repaired_response)
    except Exception as retry_e:
        raise ValueError(
            f"The AI model failed to output compliant structured analysis: {retry_e}"
        ) from retry_e


def _parse_ai_score(value: Any) -> Optional[int]:
    """Clamp the AI review score to 0-100; None if missing or non-numeric."""
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return None


@app.post("/api/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    _: None = Depends(rate_limit_analyze),
):
    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. "
            "Please verify the .env configuration.",
        )

    # Read once — a second UploadFile.read() returns b"" (stream is at EOF)
    file_bytes = await resume.read()
    _validate_resume_upload(resume, file_bytes)

    is_job_match = job_description is not None and bool(job_description.strip())

    extracted_text, _, _ = _extract_resume_text(file_bytes, resume.filename)

    extracted_text = extracted_text.strip()
    if not extracted_text:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from the PDF. "
            "The file may be scanned or image-based. "
            "Please upload a text-based PDF.",
        )

    # 1. Deterministic Scoring
    det_score_result = score_resume(extracted_text)
    deterministic_rule_score = det_score_result["total_score"]
    rule_breakdown = det_score_result["breakdown"]

    # 2. Extract JD requirements (if applicable) and AI Review
    if is_job_match:
        system_prompt = (
            "You are an expert AI resume reviewer. "
            "You must extract structured requirements from the job description and evaluate the resume text. "
            "You must provide an AI Review Score (0-100) reflecting clarity, impact, positioning, conciseness, and overall resume strength. "
            "Evaluate whether the resume communicates information efficiently and remains easy to scan. "
            "Identify overly long bullets, verbose summaries, paragraph-heavy content, and unnecessary repetition. "
            "Do not penalize a resume solely for being two pages long. Focus on content efficiency rather than page count. "
            "Do not evaluate, criticize, or score resume date formatting or date consistency. "
            "Explain any meaningful disagreement between the Deterministic Rule Score and your AI Review Score in a 'score_gap_insight'. "
            "The deterministic score measures ATS-oriented structure and parseability, not content quality. DO NOT recalculate it. DO NOT fabricate candidate claims. "
            "Output MUST be valid JSON."
        )

        user_prompt = f"""
Deterministic Rule Score: {deterministic_rule_score}/100

RESUME CONTENT:
\"\"\"
{extracted_text}
\"\"\"

JOB DESCRIPTION:
\"\"\"
{job_description}
\"\"\"

Return a valid JSON object:
{{
  "ai_review_score": 75,
  "score_gap_insight": "Insight explaining the difference between the deterministic {deterministic_rule_score} and your AI review score.",
  "jd_requirements": {{
    "target_title": "AI Engineer",
    "required_skills": ["python", "fastapi"],
    "preferred_skills": ["docker"],
    "domain_keywords": ["backend", "api"],
    "responsibilities": ["design APIs"]
  }},
  "summary": "AI summary of the resume.",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": [
    {{"title": "string", "description": "string", "priority": "high|medium|low"}}
  ],
  "improved_bullets": [
    {{"original": "string", "improved": "string"}}
  ],
  "interview_focus": ["string"]
}}
"""
    else:
        system_prompt = (
            "You are an expert AI resume reviewer. "
            "You must provide an AI Review Score (0-100) reflecting clarity, impact, positioning, conciseness, and overall resume strength. "
            "Evaluate whether the resume communicates information efficiently and remains easy to scan. "
            "Identify overly long bullets, verbose summaries, paragraph-heavy content, and unnecessary repetition. "
            "Do not penalize a resume solely for being two pages long. Focus on content efficiency rather than page count. "
            "Do not evaluate, criticize, or score resume date formatting or date consistency. "
            "Explain any meaningful disagreement between the Deterministic Rule Score and your AI Review Score in a 'score_gap_insight'. "
            "The deterministic score measures ATS-oriented structure and parseability, not content quality. DO NOT recalculate it. DO NOT fabricate candidate claims. "
            "Output MUST be valid JSON."
        )

        user_prompt = f"""
Deterministic Rule Score: {deterministic_rule_score}/100

RESUME CONTENT:
\"\"\"
{extracted_text}
\"\"\"

Return a valid JSON object:
{{
  "ai_review_score": 75,
  "score_gap_insight": "Insight explaining the difference between the deterministic {deterministic_rule_score} and your AI review score.",
  "summary": "AI summary of the resume.",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": [
    {{"title": "string", "description": "string", "priority": "high|medium|low"}}
  ],
  "improved_bullets": [
    {{"original": "string", "improved": "string"}}
  ]
}}
"""

    # The AI review is best-effort: if the provider call or JSON repair fails,
    # still return the deterministic ATS results instead of failing the request.
    parsed_json: Dict[str, Any] = {}
    ai_error: Optional[str] = None
    try:
        parsed_json = await _run_ai_review(llm_client, system_prompt, user_prompt)
    except HTTPException as e:
        ai_error = str(e.detail)
    except Exception as e:  # noqa: BLE001 — any AI failure degrades, never 500s
        ai_error = f"The AI review failed: {e}"
    if ai_error:
        logger.warning("[ANALYZE] AI review unavailable, returning rule-based results only | %s", ai_error)

    ai_review_score = _parse_ai_score(parsed_json.get("ai_review_score")) if not ai_error else None
    if ai_review_score is None and not ai_error:
        ai_error = "The AI review returned no usable score."

    job_match_score = None
    job_match_breakdown = None
    matched_keywords = []
    missing_keywords = []
    interview_focus = []

    # Job match needs AI-extracted JD requirements; skip it when the AI failed
    if is_job_match and parsed_json:
        try:
            jd_requirements = JDRequirements.model_validate(
                parsed_json.get("jd_requirements", {})
            ).model_dump()
        except Exception:
            jd_requirements = JDRequirements().model_dump()
        match_result = calculate_job_match(extracted_text, jd_requirements)
        job_match_score = match_result["total_score"]
        job_match_breakdown = match_result["breakdown"]
        matched_keywords = match_result["all_matched_keywords"]
        missing_keywords = match_result["all_missing_keywords"]
        interview_focus = parsed_json.get("interview_focus", [])

    # Analyzer suggestions are generated content too. Only surface a rewritten
    # bullet whose original really is in the resume, and check its claims against
    # that original bullet alone (not the whole resume), so a rewrite can't borrow
    # numbers or technologies from another entry.
    safe_improved_bullets = []
    for item in parsed_json.get("improved_bullets", []) or []:
        if not isinstance(item, dict):
            continue
        original = str(item.get("original", ""))
        improved = str(item.get("improved", ""))
        if is_safe_rewrite(original, improved, extracted_text):
            safe_improved_bullets.append({"original": original, "improved": improved})

    return {
        "analysis_mode": "job_match" if is_job_match else "general",
        "ai_review_available": ai_error is None,
        "ai_review_error": ai_error,
        "scores": {
            "deterministic_rule_score": deterministic_rule_score,
            "ai_review_score": ai_review_score,
            "job_match_score": job_match_score,
        },
        "score_gap_insight": (
            parsed_json.get(
                "score_gap_insight",
                "Rule-based and AI evaluation show broadly consistent resume quality.",
            )
            if not ai_error
            else ""
        ),
        "rule_breakdown": rule_breakdown,
        "job_match_breakdown": job_match_breakdown,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "summary": (
            parsed_json.get("summary", "Resume evaluated.")
            if not ai_error
            else "AI review is unavailable right now — showing rule-based ATS results only."
        ),
        "strengths": parsed_json.get("strengths", []),
        "weaknesses": parsed_json.get("weaknesses", []),
        "suggestions": parsed_json.get("suggestions", []),
        "improved_bullets": safe_improved_bullets,
        "interview_focus": interview_focus,
    }


# -------------------------------------------------------------------
# /api/improve — AI-powered text improvement
# -------------------------------------------------------------------


@app.post("/api/improve")
async def improve_text(req: ImproveRequest, _: None = Depends(rate_limit_improve)):
    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured.",
        )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text to improve cannot be empty.")
    if len(req.text) > 20_000 or (req.context and len(req.context) > 5_000):
        raise HTTPException(status_code=413, detail="Text is too long to improve.")

    system_prompt = (
        "You are an expert resume writer. Your job is to improve professional wording. "
        "DO NOT invent facts, numbers, metrics, technologies, or job titles. Keep the text truthful. "
        "Output ONLY valid JSON containing 'improved_text' and optionally 'insight'."
    )

    if req.type == "summary":
        user_prompt = (
            "Improve the professional resume summary below to make it highly professional, "
            "well-structured, and optimized for ATS keywords, based only on the facts present.\n\n"
            f"Original Summary:\n{req.text}\n\n"
            'Return JSON: {"improved_text": "..."}'
        )
    elif req.type == "achievement":
        context_str = f" in the context of: {req.context}" if req.context else ""
        user_prompt = (
            f"Improve this achievement{context_str} to clarify professional wording. "
            "Do not invent rank, participants, percentages, or awards not present.\n\n"
            f"Original Achievement:\n{req.text}\n\n"
            'Return JSON: {"improved_text": "...", "insight": "..."}'
        )
    else:  # bullet
        context_str = f" in the context of: {req.context}" if req.context else ""
        user_prompt = (
            f"Rewrite this resume bullet point{context_str} using the XYZ formula "
            "(Accomplished [X] as measured by [Y], by doing [Z]). "
            "Make it action-oriented and use strong verbs. Do not fabricate new facts or metrics.\n\n"
            f"Original Bullet:\n{req.text}\n\n"
            'Return JSON: {"improved_text": "..."}'
        )

    improved_raw = await llm_client.chat_completion(system_prompt, user_prompt)

    parsed_json = {}
    try:
        parsed_json = clean_and_parse_json(improved_raw)
    except Exception:
        improved_clean = improved_raw.strip()
        if improved_clean.startswith('"') and improved_clean.endswith('"'):
            improved_clean = improved_clean[1:-1].strip()
        elif improved_clean.startswith("'") and improved_clean.endswith("'"):
            improved_clean = improved_clean[1:-1].strip()
        parsed_json = {"improved_text": improved_clean}

    improved_text = parsed_json.get("improved_text", "")

    # Validation step
    if not validate_generated_claims(req.text, improved_text, req.context):
        # Repair attempt
        repair_system_prompt = (
            system_prompt
            + "\n\nCRITICAL: You just hallucinated a numeric claim "
            "(e.g., a percentage, dollar amount, or count) that was NOT present "
            "in the source text. You must remove it and stick ONLY to the facts provided."
        )
        improved_raw_2 = await llm_client.chat_completion(repair_system_prompt, user_prompt)

        try:
            parsed_json = clean_and_parse_json(improved_raw_2)
        except Exception:
            improved_clean = improved_raw_2.strip()
            if improved_clean.startswith('"') and improved_clean.endswith('"'):
                improved_clean = improved_clean[1:-1].strip()
            elif improved_clean.startswith("'") and improved_clean.endswith("'"):
                improved_clean = improved_clean[1:-1].strip()
            parsed_json = {"improved_text": improved_clean}

        improved_text_2 = parsed_json.get("improved_text", "")

        # Second validation
        if not validate_generated_claims(req.text, improved_text_2, req.context):
            raise HTTPException(
                status_code=400,
                detail="AI attempted to introduce unsupported claims. Improvement rejected.",
            )

        return parsed_json

    return parsed_json


# -------------------------------------------------------------------
# /api/ats/optimize — ATS optimization layer
#
# Takes extracted resume text and returns structured data matching
# the frontend Resume type, with ATS-friendly cleaning:
#   - Removes extraction artifacts ("envelop~" before emails, etc.)
#   - Normalizes formatting and categorizes links
#   - Preserves all original content — no fabrication
#   - Output matches frontend types/resume.ts exactly
# -------------------------------------------------------------------


@app.post("/api/ats/optimize")
async def ats_optimize_resume(
    resume: UploadFile = File(...),
    _: None = Depends(rate_limit_ats),
):
    """Upload a PDF or DOCX resume and receive ATS-optimized structured data.

    The ATS optimization layer:
      1. EXTRACT text from the document (PDF or DOCX)
      2. BUILD ATS-optimized prompts
      3. LLM parses and cleans the text
      4. POST-PROCESS: clean artifacts, normalize links, validate

    Returns data matching the frontend Resume type format:
      profile (with categorized links), summary, experience,
      education, skills, projects, achievements, certifications,
      languages, research, publications.

    No builder fields (id, enabled, template, layout, sectionOrder).
    """
    # Read once — a second UploadFile.read() returns b"" (stream is at EOF)
    file_bytes = await resume.read()
    _validate_resume_upload(resume, file_bytes)

    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. "
            "Please verify the .env configuration.",
        )

    extracted_text, embedded_links, page_count = _extract_resume_text(
        file_bytes, resume.filename
    )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from the document. "
            "The file may be scanned, image-based, or empty. "
            "Please upload a text-based PDF or DOCX.",
        )

    # Augment text with embedded hyperlinks so the LLM sees both
    llm_text = extracted_text
    if embedded_links:
        unique_urls = list(dict.fromkeys(link["url"] for link in embedded_links))
        links_block = "\n".join(f"  [Embedded Hyperlink] {url}" for url in unique_urls)
        llm_text += (
            f"\n\n--- EMBEDDED DOCUMENT HYPERLINKS (clickable links in the resume) ---\n"
            f"{links_block}\n"
            f"--- END EMBEDDED HYPERLINKS ---\n\n"
            "Note: Where the visible text link and an embedded hyperlink disagree, "
            "the embedded hyperlink is more reliable. Prefer it."
        )

    # Run ATS optimization
    result = await run_ats_optimization(
        extracted_text=llm_text,
        llm_client=llm_client,
    )

    logger.info(
        "[ATS-ENDPOINT] Optimization complete | sections=%s",
        [k for k, v in result.items() if v],
    )

    return result
