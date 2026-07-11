import os
import io
import json
import re
import logging
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pypdf
import httpx
from dotenv import load_dotenv
from services.scoring_service import score_resume
from services.jd_service import calculate_job_match

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ResumeForge-Backend")

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="ResumeForge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

def get_openrouter_config():
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
    
    if model.startswith("OPENROUTER_MODEL="):
        model = model[len("OPENROUTER_MODEL="):].strip()
    else:
        model = model.strip()
        
    if not api_key or api_key.strip() == "" or "your_openrouter_api_key" in api_key:
        return None, model
    return api_key.strip(), model

class ImproveRequest(BaseModel):
    type: str = Field(pattern="^(summary|bullet|project_bullet|experience_bullet|achievement)$")
    text: str
    context: Optional[str] = None

def clean_and_parse_json(text_content: str) -> dict:
    cleaned = text_content.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
        
    match_code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL | re.IGNORECASE)
    if match_code_block:
        try:
            return json.loads(match_code_block.group(1).strip())
        except json.JSONDecodeError:
            pass
            
    match_braces = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if match_braces:
        try:
            return json.loads(match_braces.group(1).strip())
        except json.JSONDecodeError:
            pass
            
    raise ValueError("Failed to extract valid JSON block from LLM response.")

def extract_numeric_claims(text: str) -> List[str]:
    # Extract numbers (e.g. 15, 25%, 100,000, 3.5, 40 percent)
    claims = []
    # Match digits optionally followed by % or percent
    matches = re.findall(r"\b\d+(?:[,.]\d+)*(?:\s*%|\s*percent)?\b", text, re.IGNORECASE)
    for match in matches:
        # Normalize representations
        normalized = match.lower().replace(" percent", "%").replace(" ", "")
        claims.append(normalized)
    return claims

def validate_numeric_claims(original_text: str, improved_text: str, context: Optional[str] = None) -> bool:
    source_text = original_text + " " + (context or "")
    source_claims = extract_numeric_claims(source_text)
    improved_claims = extract_numeric_claims(improved_text)
    
    # Check if improved_claims introduces anything not in source_claims
    for claim in improved_claims:
        if claim not in source_claims:
            return False
    return True

async def call_openrouter(api_key: str, model: str, system_message: str, user_message: str) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://resumeforge.dev",
        "X-Title": "ResumeForge"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.3
    }
    
    async with httpx.AsyncClient(timeout=45.0) as client:
        try:
            response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            if response.status_code != 200:
                err_msg = response.text
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "API request failed.")
                except:
                    pass
                
                logger.error(f"OpenRouter returned status {response.status_code} for model {model}. Error: {err_msg}")
                
                if response.status_code in [401, 403]:
                    detail_msg = "ResumeForge AI is not configured correctly on the server."
                elif response.status_code == 402:
                    detail_msg = "Provider credit/payment failure."
                elif response.status_code == 429:
                    detail_msg = "The free AI provider is rate limited. Please try again shortly."
                elif response.status_code == 400 and "model" in err_msg.lower():
                    detail_msg = "The configured AI model is currently unavailable."
                elif response.status_code in [502, 503]:
                    detail_msg = "AI Provider Failure."
                else:
                    detail_msg = "AI analysis is temporarily unavailable. Please try again."
                    
                raise HTTPException(status_code=502, detail=detail_msg)
            
            res_data = response.json()
            if "choices" not in res_data or len(res_data["choices"]) == 0:
                raise HTTPException(status_code=502, detail="No choices returned from OpenRouter.")
            
            return res_data["choices"][0]["message"]["content"]
        except httpx.RequestError as exc:
            logger.error(f"Failed to reach OpenRouter: {str(exc)}")
            raise HTTPException(status_code=503, detail="Failed to connect to the AI service provider.")

@app.get("/api/health")
def health_check():
    api_key, model = get_openrouter_config()
    return {
        "status": "healthy",
        "ai_provider_configured": api_key is not None,
        "configured_model": model
    }

@app.post("/api/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: Optional[str] = Form(None)
):
    api_key, model = get_openrouter_config()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. Please verify the .env configuration."
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
        raise HTTPException(status_code=400, detail="Failed to parse PDF document. Ensure it is not password protected or corrupt.")

    extracted_text = extracted_text.strip()
    if not extracted_text:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from the PDF. The file may be scanned or image-based. Please upload a text-based PDF."
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
            "You must provide an AI Review Score (0-100) reflecting clarity, impact, positioning, and overall resume strength. "
            "Explain any meaningful disagreement between the Deterministic Rule Score and your AI Review Score in a 'score_gap_insight'. "
            "DO NOT recalculate the deterministic score. DO NOT fabricate candidate claims. "
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
            "You must provide an AI Review Score (0-100) reflecting clarity, impact, positioning, and overall resume strength. "
            "Explain any meaningful disagreement between the Deterministic Rule Score and your AI Review Score in a 'score_gap_insight'. "
            "DO NOT recalculate the deterministic score. DO NOT fabricate candidate claims. "
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
        raw_response = await call_openrouter(api_key, model, system_prompt, user_prompt)
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
            repaired_response = await call_openrouter(api_key, model, repair_system_prompt, repair_user_prompt)
            parsed_json = clean_and_parse_json(repaired_response)
        except HTTPException:
            raise
        except Exception as retry_e:
            logger.error(f"Retry repair attempt failed: {str(retry_e)}")
            raise HTTPException(
                status_code=502,
                detail=f"The AI model failed to output compliant structured analysis. Error: {str(retry_e)}"
            )

    ai_review_score = parsed_json.get("ai_review_score", 70)
    
    job_match_score = None
    job_match_breakdown = None
    matched_keywords = []
    missing_keywords = []
    interview_focus = []
    
    if is_job_match:
        jd_requirements = parsed_json.get("jd_requirements", {})
        match_result = calculate_job_match(extracted_text, jd_requirements, deterministic_rule_score)
        job_match_score = match_result["total_score"]
        job_match_breakdown = match_result["breakdown"]
        matched_keywords = match_result["all_matched_keywords"]
        missing_keywords = match_result["all_missing_keywords"]
        interview_focus = parsed_json.get("interview_focus", [])
        
    return {
        "analysis_mode": "job_match" if is_job_match else "general",
        "scores": {
            "deterministic_rule_score": deterministic_rule_score,
            "ai_review_score": ai_review_score,
            "job_match_score": job_match_score
        },
        "score_gap_insight": parsed_json.get("score_gap_insight", "Rule-based and AI evaluation show broadly consistent resume quality."),
        "rule_breakdown": rule_breakdown,
        "job_match_breakdown": job_match_breakdown,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "summary": parsed_json.get("summary", "Resume evaluated."),
        "strengths": parsed_json.get("strengths", []),
        "weaknesses": parsed_json.get("weaknesses", []),
        "suggestions": parsed_json.get("suggestions", []),
        "improved_bullets": parsed_json.get("improved_bullets", []),
        "interview_focus": interview_focus
    }

@app.post("/api/improve")
async def improve_text(req: ImproveRequest):
    api_key, model = get_openrouter_config()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured."
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
            "Return JSON: {\"improved_text\": \"...\"}"
        )
    elif req.type == "achievement":
        context_str = f" in the context of: {req.context}" if req.context else ""
        user_prompt = (
            f"Improve this achievement{context_str} to clarify professional wording. "
            "Do not invent rank, participants, percentages, or awards not present.\n\n"
            f"Original Achievement:\n{req.text}\n\n"
            "Return JSON: {\"improved_text\": \"...\", \"insight\": \"...\"}"
        )
    else:  # bullet
        context_str = f" in the context of: {req.context}" if req.context else ""
        user_prompt = (
            f"Rewrite this resume bullet point{context_str} using the XYZ formula (Accomplished [X] as measured by [Y], by doing [Z]). "
            "Make it action-oriented and use strong verbs. Do not fabricate new facts or metrics.\n\n"
            f"Original Bullet:\n{req.text}\n\n"
            "Return JSON: {\"improved_text\": \"...\"}"
        )

    improved_raw = await call_openrouter(api_key, model, system_prompt, user_prompt)
    
    parsed_json = {}
    try:
        parsed_json = clean_and_parse_json(improved_raw)
    except:
        improved_clean = improved_raw.strip()
        if improved_clean.startswith('"') and improved_clean.endswith('"'):
            improved_clean = improved_clean[1:-1].strip()
        elif improved_clean.startswith("'") and improved_clean.endswith("'"):
            improved_clean = improved_clean[1:-1].strip()
        parsed_json = {"improved_text": improved_clean}
        
    improved_text = parsed_json.get("improved_text", "")
    
    # Validation step
    if not validate_numeric_claims(req.text, improved_text, req.context):
        # Repair attempt
        repair_system_prompt = system_prompt + "\n\nCRITICAL: You just hallucinated a numeric claim (e.g., a percentage, dollar amount, or count) that was NOT present in the source text. You must remove it and stick ONLY to the facts provided."
        improved_raw_2 = await call_openrouter(api_key, model, repair_system_prompt, user_prompt)
        
        try:
            parsed_json = clean_and_parse_json(improved_raw_2)
        except:
            improved_clean = improved_raw_2.strip()
            if improved_clean.startswith('"') and improved_clean.endswith('"'):
                improved_clean = improved_clean[1:-1].strip()
            elif improved_clean.startswith("'") and improved_clean.endswith("'"):
                improved_clean = improved_clean[1:-1].strip()
            parsed_json = {"improved_text": improved_clean}
            
        improved_text_2 = parsed_json.get("improved_text", "")
        
        # Second validation
        if not validate_numeric_claims(req.text, improved_text_2, req.context):
            raise HTTPException(status_code=400, detail="AI attempted to fabricate unsupported metrics. Improvement rejected.")
        
        return parsed_json

    return parsed_json

