import os
import logging
from typing import Any, Optional, List, Dict, Tuple
from fastapi import Depends, FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from services.rate_limiter import ai_rate_limit, is_api_key_configured
from services.analyze_prompts import build_analyze_prompts

from services.scoring_service import score_resume, normalize_skill, SKILL_ALIASES
from services.jd_service import calculate_job_match
from services.llm_client import LLMClient
from services.validator import clean_and_parse_json, validate_generated_claims
from services.bullet_evidence import is_safe_rewrite
from services.import_service import run_import_pipeline
from services.extractor import extract_text_from_pdf, ExtractionResult
from services.docx_extractor import extract_text_from_docx, DocxExtractionResult
from services import screening_service
from services.ai_access import BYOK_PROVIDERS, ai_error_code, byok_target_from_request, resolve_llm_client, server_llm_client
from services.llm_client import AI_ERROR_HEADER
from services.resume_import import import_resume

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
# Business screening: requirements + briefs call the LLM; screening is
# deterministic and cheap, so it allows bulk uploads across parallel queues.
_RATE_LIMIT_REQUIREMENTS = int(os.getenv("RATE_LIMIT_REQUIREMENTS", "10"))
_RATE_LIMIT_SCREEN = int(os.getenv("RATE_LIMIT_SCREEN", "240"))
_RATE_LIMIT_BRIEF = int(os.getenv("RATE_LIMIT_BRIEF", "20"))
# One short AI call per screened resume — a higher window than briefs, and
# its own limiter so bulk summarising can't starve on-demand briefs.
_RATE_LIMIT_SUMMARY = int(os.getenv("RATE_LIMIT_SUMMARY", "60"))

rate_limit_analyze = ai_rate_limit(_RATE_LIMIT_ANALYZE, _RATE_LIMIT_WINDOW)
rate_limit_improve = ai_rate_limit(_RATE_LIMIT_IMPROVE, _RATE_LIMIT_WINDOW)
rate_limit_parse = ai_rate_limit(_RATE_LIMIT_PARSE, _RATE_LIMIT_WINDOW)
rate_limit_ats = ai_rate_limit(_RATE_LIMIT_ATS, _RATE_LIMIT_WINDOW)
rate_limit_health = ai_rate_limit(_RATE_LIMIT_HEALTH, _RATE_LIMIT_WINDOW)
rate_limit_requirements = ai_rate_limit(_RATE_LIMIT_REQUIREMENTS, _RATE_LIMIT_WINDOW)
rate_limit_screen = ai_rate_limit(_RATE_LIMIT_SCREEN, _RATE_LIMIT_WINDOW)
rate_limit_brief = ai_rate_limit(_RATE_LIMIT_BRIEF, _RATE_LIMIT_WINDOW)
rate_limit_summary = ai_rate_limit(_RATE_LIMIT_SUMMARY, _RATE_LIMIT_WINDOW)
rate_limit_key_check = ai_rate_limit(int(os.getenv("RATE_LIMIT_KEY_CHECK", "10")), _RATE_LIMIT_WINDOW)

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
    # Any localhost/dev port works in development; production is pinned to
    # the deployed frontend (and any Vercel preview of it).
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://([a-z0-9-]+\.)?resume-forge-chi-five\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Retry-After drives client back-off; X-AI-Error tells the UI when to
    # ask for the user's own key. Cross-origin JS can't read them otherwise.
    expose_headers=["Retry-After", AI_ERROR_HEADER],
)


# -------------------------------------------------------------------
# Model definitions
# -------------------------------------------------------------------


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


# Job descriptions longer than this are almost always pasted page chrome
MAX_JOB_DESCRIPTION_CHARS = 20000
MIN_JOB_DESCRIPTION_CHARS = 50


class RequirementsRequest(BaseModel):
    job_description: str = Field(min_length=MIN_JOB_DESCRIPTION_CHARS, max_length=MAX_JOB_DESCRIPTION_CHARS)


class CandidateBriefRequest(BaseModel):
    resume_text: str = Field(min_length=1, max_length=60000)
    job_description: str = Field(min_length=1, max_length=MAX_JOB_DESCRIPTION_CHARS)
    jd_requirements: JDRequirements
    match_score: Optional[int] = None
    missing_keywords: List[str] = Field(default_factory=list)


class CandidateSummaryRequest(BaseModel):
    resume_text: str = Field(min_length=1, max_length=60000)
    job_description: str = Field(min_length=1, max_length=MAX_JOB_DESCRIPTION_CHARS)
    jd_requirements: JDRequirements
    match_score: Optional[int] = None
    missing_keywords: List[str] = Field(default_factory=list)


# -------------------------------------------------------------------
# Health
# -------------------------------------------------------------------


@app.get("/api/health")
def health_check():
    llm = server_llm_client()
    return {
        "status": "healthy",
        "ai_provider_configured": llm is not None,
        "configured_model": llm.model if llm else "",
        "model_chain": llm.model_chain if llm else [],
        "api_key_required": is_api_key_configured(),
        "supported_formats": ["pdf", "docx"],
        "byok_providers": {name: {"default_model": p.default_model} for name, p in BYOK_PROVIDERS.items()},
    }


# -------------------------------------------------------------------
# /api/parse — Import pipeline (extract → prompt → LLM → validate)
# -------------------------------------------------------------------


@app.post("/api/parse")
async def parse_resume_endpoint(
    request: Request,
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
    llm_client = resolve_llm_client(request, "individual")

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
    request: Request,
    resume: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    _: None = Depends(rate_limit_analyze),
):

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

    # 2. AI Review (JD requirements are extracted inside the same call when a JD is given)
    system_prompt, user_prompt = build_analyze_prompts(
        extracted_text, deterministic_rule_score, job_description or ""
    )

    # The AI review is best-effort: if the provider call or JSON repair fails,
    # still return the deterministic ATS results instead of failing the request.
    parsed_json: Dict[str, Any] = {}
    ai_error: Optional[str] = None
    ai_error_code_value: Optional[str] = None
    try:
        llm_client = resolve_llm_client(request, "individual")
        parsed_json = await _run_ai_review(llm_client, system_prompt, user_prompt)
    except HTTPException as e:
        ai_error = str(e.detail)
        ai_error_code_value = ai_error_code(e)
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
        "ai_review_error_code": ai_error_code_value,
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
async def improve_text(request: Request, req: ImproveRequest, _: None = Depends(rate_limit_improve)):
    llm_client = resolve_llm_client(request, "individual")

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
    request: Request,
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

    extracted_text, embedded_links, page_count = await run_in_threadpool(
        _extract_resume_text, file_bytes, resume.filename
    )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from the document. "
            "The file may be scanned, image-based, or empty. "
            "Please upload a text-based PDF or DOCX.",
        )

    # Deterministic parse first; the AI layer (individual plan: server keys,
    # then the user's key) reviews it. Without AI the draft is returned.
    result = await import_resume(
        extracted_text,
        embedded_links,
        lambda: resolve_llm_client(request, "individual"),
    )

    logger.info(
        "[ATS-ENDPOINT] Import complete | ai_review=%s | sections=%s",
        result["import_meta"]["ai_review"],
        [k for k, v in result.items() if v and k != "import_meta"],
    )

    return result


# -------------------------------------------------------------------
# ResumeForge for Businesses — bulk screening
#
#   /api/business/requirements  JD → structured requirements (AI, once per queue)
#   /api/business/screen        one resume × requirements → score (no AI)
#   /api/business/summary       one candidate → one-sentence AI take (AI, per resume)
#   /api/business/brief         one candidate → written brief (AI, on demand)
#
# Nothing is stored server-side; the browser holds every queue.
# -------------------------------------------------------------------


@app.post("/api/business/requirements")
async def business_requirements(
    request: Request,
    req: RequirementsRequest,
    _: None = Depends(rate_limit_requirements),
):
    """Extract the requirements every resume in a queue is scored against."""
    llm_client = resolve_llm_client(request, "business")
    try:
        parsed = await _run_ai_review(
            llm_client,
            screening_service.REQUIREMENTS_SYSTEM_PROMPT,
            screening_service.build_requirements_prompt(req.job_description.strip()),
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    requirements = screening_service.clean_requirements(parsed)
    if not any(requirements[k] for k in ("required_skills", "preferred_skills", "domain_keywords", "responsibilities")):
        raise HTTPException(
            status_code=422,
            detail="No requirements could be found in that job description. "
            "Paste the full posting, including its qualifications.",
        )
    return {"jd_requirements": requirements}


@app.post("/api/business/screen")
async def business_screen(
    resume: UploadFile = File(...),
    jd_requirements: str = Form(...),
    _: None = Depends(rate_limit_screen),
):
    """Score one resume deterministically against a queue's requirements."""
    try:
        requirements = JDRequirements.model_validate_json(jd_requirements).model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid job requirements payload.") from exc

    file_bytes = await resume.read()
    _validate_resume_upload(resume, file_bytes)

    # Extraction and scoring are CPU-bound; keep them off the event loop so
    # parallel queues don't serialise behind one another.
    def run() -> Dict[str, Any]:
        text, _, _ = _extract_resume_text(file_bytes, resume.filename)
        text = text.strip()
        if not text:
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted — the file may be scanned or image-based.",
            )
        result = screening_service.screen_resume(text, requirements)
        result["resume_text"] = text
        return result

    return await run_in_threadpool(run)


@app.post("/api/business/summary")
async def business_summary(
    request: Request,
    req: CandidateSummaryRequest,
    _: None = Depends(rate_limit_summary),
):
    """One-sentence AI take on one screened candidate (the table's summary column)."""
    llm_client = resolve_llm_client(request, "business")
    try:
        parsed = await _run_ai_review(
            llm_client,
            screening_service.SUMMARY_SYSTEM_PROMPT,
            screening_service.build_summary_prompt(
                req.resume_text,
                req.job_description,
                req.jd_requirements.model_dump(),
                req.match_score,
                req.missing_keywords,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    summary = screening_service.clean_summary(parsed)
    if not summary["summary"]:
        raise HTTPException(status_code=502, detail="The AI returned an empty summary. Please try again.")
    return summary


@app.post("/api/business/brief")
async def business_brief(
    request: Request,
    req: CandidateBriefRequest,
    _: None = Depends(rate_limit_brief),
):
    """Write a short, evidence-grounded brief for one candidate."""
    llm_client = resolve_llm_client(request, "business")
    try:
        parsed = await _run_ai_review(
            llm_client,
            screening_service.BRIEF_SYSTEM_PROMPT,
            screening_service.build_brief_prompt(
                req.resume_text,
                req.job_description,
                req.jd_requirements.model_dump(),
                req.match_score,
                req.missing_keywords,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    brief = screening_service.clean_brief(parsed)
    # A strength must be backed by the resume: drop any that cite numbers or
    # technologies the resume doesn't contain. (Gaps legitimately name missing skills.)
    brief["strengths"] = [
        s for s in brief["strengths"] if validate_generated_claims(req.resume_text, s)
    ]
    if not brief["summary"]:
        raise HTTPException(status_code=502, detail="The AI returned an empty brief. Please try again.")
    return brief


# -------------------------------------------------------------------
# /api/ai/key-check — verify a user's own key (BYOK) before relying on it
# -------------------------------------------------------------------


@app.post("/api/ai/key-check")
async def ai_key_check(request: Request, _: None = Depends(rate_limit_key_check)):
    """Send a tiny request with the user's key so AI settings can confirm it works."""
    target = byok_target_from_request(request)
    if target is None:
        raise HTTPException(status_code=400, detail="No API key was provided.", headers={AI_ERROR_HEADER: "byok_required"})
    await LLMClient([target]).chat_completion(
        "Reply with the single word OK.", "Say OK.", temperature=0
    )
    return {"ok": True, "provider": target.provider, "model": target.model}
