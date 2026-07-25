import os
import io
import re
import logging
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pypdf
from dotenv import load_dotenv

from services.scoring_service import score_resume, normalize_skill, SKILL_ALIASES
from services.jd_service import calculate_job_match
from services.llm_client import LLMClient
from services.validator import clean_and_parse_json, validate_generated_claims
from services.import_service import run_import_pipeline

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
        "configured_model": model,
    }


# -------------------------------------------------------------------
# /api/parse — Import pipeline (extract → prompt → LLM → validate)
# -------------------------------------------------------------------


@app.post("/api/parse")
async def parse_resume_endpoint(resume: UploadFile = File(...)):
    """Upload a PDF resume and receive structured parsed data.

    The pipeline runs through five stages:
      1. EXTRACT  → PDF text extraction
      2. PROMPT   → LLM prompt construction
      3. LLM      → OpenRouter chat completion
      4. VALIDATE → JSON parsing and structure validation
      5. ORCHESTRATE → stage coordination and error recovery

    Returns pure resume data (profile, education, experience, skills, etc.)
    without any builder-specific concerns (sectionOrder, template, layout).
    """
    # Validate file type
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resume uploads are supported.")

    # Check configuration
    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. "
            "Please verify the .env configuration.",
        )

    # Read PDF bytes
    pdf_bytes = await resume.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF file is empty.")

    # Run the pipeline
    result = await run_import_pipeline(
        pdf_bytes=pdf_bytes,
        filename=resume.filename,
        llm_client=llm_client,
    )

    return result.to_response_dict()


# -------------------------------------------------------------------
# /api/analyze — Full resume analysis (scoring + AI review + job match)
# -------------------------------------------------------------------


@app.post("/api/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
):
    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. "
            "Please verify the .env configuration.",
        )

    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resume uploads are supported.")

    is_job_match = job_description is not None and bool(job_description.strip())

    pdf_bytes = await resume.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF file is empty.")

    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = pypdf.PdfReader(pdf_file)
        extracted_text = ""
        for page in reader.pages:
            extracted_text += page.extract_text() or ""
    except Exception as e:
        logger.error(f"Error reading PDF: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Failed to parse PDF document. Ensure it is not password protected or corrupt.",
        )

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

    raw_response = ""
    parsed_json = {}

    try:
        raw_response = await llm_client.chat_completion(system_prompt, user_prompt)
        parsed_json = clean_and_parse_json(raw_response)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Initial JSON parsing failed: {str(e)}. Attempting repair retry...")
        repair_system_prompt = (
            "You are a JSON correction assistant. Fix the JSON and return valid JSON only."
        )
        repair_user_prompt = f"""
ERROR: {str(e)}
JSON OUTPUT:
{raw_response if raw_response else str(parsed_json)}
Correct this to output ONLY valid JSON.
"""
        try:
            repaired_response = await llm_client.chat_completion(
                repair_system_prompt, repair_user_prompt
            )
            parsed_json = clean_and_parse_json(repaired_response)
        except HTTPException:
            raise
        except Exception as retry_e:
            logger.error(f"Retry repair attempt failed: {str(retry_e)}")
            raise HTTPException(
                status_code=502,
                detail=f"The AI model failed to output compliant structured analysis. Error: {str(retry_e)}",
            )

    ai_review_score = max(0, min(100, int(parsed_json.get("ai_review_score", 70))))

    job_match_score = None
    job_match_breakdown = None
    matched_keywords = []
    missing_keywords = []
    interview_focus = []

    if is_job_match:
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

    # Analyzer suggestions are generated content too. Do not surface a rewritten
    # bullet unless its original is present in the uploaded evidence and it passes
    # the same deterministic claim gate used by the editor improvement endpoint.
    safe_improved_bullets = []
    for item in parsed_json.get("improved_bullets", []):
        if not isinstance(item, dict):
            continue
        original = str(item.get("original", ""))
        improved = str(item.get("improved", ""))
        if original and original.lower() in extracted_text.lower() and validate_generated_claims(
            extracted_text, improved
        ):
            safe_improved_bullets.append({"original": original, "improved": improved})

    return {
        "analysis_mode": "job_match" if is_job_match else "general",
        "scores": {
            "deterministic_rule_score": deterministic_rule_score,
            "ai_review_score": ai_review_score,
            "job_match_score": job_match_score,
        },
        "score_gap_insight": parsed_json.get(
            "score_gap_insight",
            "Rule-based and AI evaluation show broadly consistent resume quality.",
        ),
        "rule_breakdown": rule_breakdown,
        "job_match_breakdown": job_match_breakdown,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "summary": parsed_json.get("summary", "Resume evaluated."),
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
async def improve_text(req: ImproveRequest):
    api_key, model = get_openrouter_config()
    llm_client = LLMClient.from_env(api_key, model)
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured.",
        )

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text to improve cannot be empty.")

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
