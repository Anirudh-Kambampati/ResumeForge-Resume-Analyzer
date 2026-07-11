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

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ResumeForge-Backend")

# Load environment variables
# Check current directory and parent directory for .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="ResumeForge API", version="1.0.0")

# CORS Setup
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenRouter client configuration
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

def get_openrouter_config():
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
    
    if model.startswith("OPENROUTER_MODEL="):
        model = model[len("OPENROUTER_MODEL="):].strip()
    else:
        model = model.strip()
        
    # Check for empty or template key values
    if not api_key or api_key.strip() == "" or "your_openrouter_api_key" in api_key:
        return None, model
    return api_key.strip(), model

# Response schemas for validation
class SuggestionItem(BaseModel):
    title: str
    description: str
    priority: str = Field(pattern="^(high|medium|low)$")

class SectionScores(BaseModel):
    skills: int = Field(ge=0, le=100)
    experience: int = Field(ge=0, le=100)
    projects: int = Field(ge=0, le=100)
    education: int = Field(ge=0, le=100)

class ImprovedBullet(BaseModel):
    original: str
    improved: str

class AnalysisResult(BaseModel):
    mode: str = Field(pattern="^(general|job_match)$")
    ats_score: int = Field(ge=0, le=100)
    summary: str
    matched_keywords: List[str]
    missing_keywords: List[str]
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[SuggestionItem]
    section_scores: SectionScores
    improved_bullets: List[ImprovedBullet]
    interview_focus: List[str]

class ImproveRequest(BaseModel):
    type: str = Field(pattern="^(summary|bullet)$")
    text: str
    context: Optional[str] = None

# Helpers
def clean_and_parse_json(text_content: str) -> dict:
    """Strips markdown fences and parses raw JSON string safely."""
    cleaned = text_content.strip()
    
    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
        
    # Search for JSON block wrapped in ```json ... ``` or ``` ... ```
    match_code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL | re.IGNORECASE)
    if match_code_block:
        try:
            return json.loads(match_code_block.group(1).strip())
        except json.JSONDecodeError:
            pass
            
    # Try finding the first '{' and last '}'
    match_braces = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if match_braces:
        try:
            return json.loads(match_braces.group(1).strip())
        except json.JSONDecodeError:
            pass
            
    raise ValueError("Failed to extract valid JSON block from LLM response.")

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
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            if response.status_code != 200:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "API request failed.")
                except:
                    err_msg = response.text
                
                logger.error(f"OpenRouter returned status {response.status_code} for model {model}. Error: {err_msg}")
                
                if response.status_code in [401, 403]:
                    detail_msg = "ResumeForge AI is not configured correctly on the server."
                elif response.status_code == 429:
                    detail_msg = "The free AI provider is rate limited. Please try again shortly."
                elif response.status_code == 400 and "model" in err_msg.lower():
                    detail_msg = "The configured AI model is currently unavailable."
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
    # 1. API Key validation
    api_key, model = get_openrouter_config()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. Please verify the .env configuration."
        )

    # 2. Input validation
    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resume uploads are supported.")
        
    is_job_match = job_description is not None and bool(job_description.strip())

    # 3. PDF extraction
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

    # 4. OpenRouter call with schema reinforcement
    if is_job_match:
        system_prompt = (
            "You are an expert ATS (Applicant Tracking System) optimizer and professional resume reviewer. "
            "Your task is to analyze the candidate's resume text against a job description. "
            "You must thoroughly evaluate the resume against the job description covering: "
            "required skills alignment, preferred skills alignment, matched keywords, missing keywords, "
            "experience relevance, project relevance, terminology alignment, and role-specific improvements. "
            "You MUST respond with a single valid JSON object matching the requested schema. "
            "Do not include markdown code fences, prose, or introductions outside the JSON structure."
        )

        user_prompt = f"""
Analyze the resume content against the job description below.

You must evaluate and address:
- required skills alignment
- preferred skills alignment
- matched keywords
- missing keywords
- experience relevance
- project relevance
- terminology alignment
- role-specific improvements

RESUME CONTENT:
\"\"\"
{extracted_text}
\"\"\"

JOB DESCRIPTION:
\"\"\"
{job_description}
\"\"\"

Return a valid JSON object matching this schema:
{{
  "mode": "job_match",
  "ats_score": 75, // Int 0-100 representing job description match and overall ATS layout compliance
  "summary": "Overall compliance evaluation summary. Keep it brief and constructive.",
  "matched_keywords": ["python", "fastapi"], // exact or semantic matches relevant to the job requirements
  "missing_keywords": ["aws", "docker"], // keywords or requirements from the job description not in the resume
  "strengths": ["List of core strengths...", "e.g. good backend projects"],
  "weaknesses": ["List of gaps or design weaknesses...", "e.g. no concrete metrics"],
  "suggestions": [
    {{
      "title": "Name of suggestion",
      "description": "Detailed actionable improvement description",
      "priority": "high" // must be "high", "medium", or "low"
    }}
  ],
  "section_scores": {{
    "skills": 85, // 0-100
    "experience": 70, // 0-100
    "projects": 75, // 0-100
    "education": 90 // 0-100
  }},
  "improved_bullets": [
    {{
      "original": "A specific bullet point from the resume experience or projects that lacks impact or metrics",
      "improved": "An optimized version of that bullet point. Focus on active verbs, structure, and impact. Do NOT fabricate metrics, companies, or technologies."
    }}
  ],
  "interview_focus": [
    "Key topic or architectural concept the candidate should review for this specific job position based on their gaps"
  ]
}}
"""
    else:
        system_prompt = (
            "You are an expert ATS (Applicant Tracking System) optimizer and professional resume reviewer. "
            "Your task is to analyze the candidate's resume text for general ATS readiness and layout/content compliance. "
            "You must thoroughly evaluate the resume covering: PDF/text readability, section completeness, "
            "standard section naming, resume structure, bullet quality, action verbs, measurable impact, "
            "skills presentation, keyword quality, generic wording, and resume completeness. "
            "You MUST respond with a single valid JSON object matching the requested schema. "
            "Do not include markdown code fences, prose, or introductions outside the JSON structure."
        )

        user_prompt = f"""
Analyze the resume content for general ATS readiness and overall professional presentation.

You must evaluate and address:
- PDF/text readability
- section completeness
- standard section naming
- resume structure
- bullet quality
- action verbs
- measurable impact
- skills presentation
- keyword quality
- generic wording
- resume completeness

RESUME CONTENT:
\"\"\"
{extracted_text}
\"\"\"

Return a valid JSON object matching this schema:
{{
  "mode": "general",
  "ats_score": 85, // Int 0-100 representing overall ATS readiness and layout compliance
  "summary": "Overall compliance evaluation summary. Keep it brief and constructive.",
  "matched_keywords": [], // Must be empty list in general mode
  "missing_keywords": [], // Must be empty list in general mode
  "strengths": ["List of core strengths...", "e.g. strong action verbs in experience"],
  "weaknesses": ["List of general weaknesses...", "e.g. lack of measurable metrics"],
  "suggestions": [
    {{
      "title": "Name of suggestion",
      "description": "Detailed actionable improvement description",
      "priority": "high" // must be "high", "medium", or "low"
    }}
  ],
  "section_scores": {{
    "skills": 85, // 0-100
    "experience": 70, // 0-100
    "projects": 75, // 0-100
    "education": 90 // 0-100
  }},
  "improved_bullets": [
    {{
      "original": "A specific bullet point from the resume experience or projects that lacks impact or metrics",
      "improved": "An optimized version of that bullet point. Focus on active verbs, structure, XYZ formula, and impact. Do NOT fabricate facts, companies, or technologies."
    }}
  ],
  "interview_focus": [] // Must be empty list in general mode
}}
"""

    raw_response = ""
    parsed_json = {}
    
    try:
        raw_response = await call_openrouter(api_key, model, system_prompt, user_prompt)
        parsed_json = clean_and_parse_json(raw_response)
        
        # Validate schema using Pydantic
        validated = AnalysisResult(**parsed_json)
        return validated.dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Initial JSON parsing or schema validation failed: {str(e)}. Attempting repair retry...")
        
        # 5. One repair/retry attempt
        repair_system_prompt = (
            "You are a JSON correction assistant. You will be given a malformed or invalid JSON object "
            "and the error message. You must correct the structure, clean up any trailing commas, escape sequences, "
            "missing fields or invalid values, and return ONLY a valid JSON object matching the requested schema."
        )
        
        repair_user_prompt = f"""
The JSON below failed validation.

ERROR:
{str(e)}

JSON OUTPUT:
\"\"\"
{raw_response if raw_response else str(parsed_json)}
\"\"\"

Correct this and output the perfect, valid JSON matching the schema:
- mode: string ("general" or "job_match")
- ats_score: int 0-100
- summary: string
- matched_keywords: list of strings
- missing_keywords: list of strings
- strengths: list of strings
- weaknesses: list of strings
- suggestions: list of objects with title (str), description (str), priority (low, medium, or high)
- section_scores: object with skills (0-100), experience (0-100), projects (0-100), education (0-100)
- improved_bullets: list of objects with original (str), improved (str)
- interview_focus: list of strings
"""
        try:
            repaired_response = await call_openrouter(api_key, model, repair_system_prompt, repair_user_prompt)
            repaired_parsed = clean_and_parse_json(repaired_response)
            validated = AnalysisResult(**repaired_parsed)
            return validated.dict()
        except HTTPException:
            raise
        except Exception as retry_e:
            logger.error(f"Retry repair attempt failed: {str(retry_e)}")
            # If AI fails twice, build a fallback response from the parsed JSON (if any) or report server error
            raise HTTPException(
                status_code=502,
                detail=f"The AI model failed to output compliant structured analysis. Error: {str(retry_e)}"
            )

@app.post("/api/improve")
async def improve_text(req: ImproveRequest):
    # 1. API Key validation
    api_key, model = get_openrouter_config()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured on the backend server. Please verify the .env configuration."
        )

    # 2. Input validation
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text to improve cannot be empty.")

    system_prompt = (
        "You are an expert resume writer. Your job is to improve professional wording. "
        "You must make the input text more professional, impact-driven, and clear. "
        "DO NOT invent facts, numbers, metrics, technologies, or job titles. Keep the text truthful. "
        "Output ONLY the improved text, with no wrappers, introductions, quotes, or conversational phrases."
    )

    if req.type == "summary":
        user_prompt = (
            "Improve the professional resume summary below to make it highly professional, "
            "well-structured, and optimized for ATS keywords, based only on the facts present. "
            "Do not start with greetings or comments. Do not wrap the text in quotes.\n\n"
            f"Original Summary:\n{req.text}"
        )
    else:  # bullet
        context_str = f" in the context of: {req.context}" if req.context else ""
        user_prompt = (
            f"Rewrite this resume bullet point{context_str} using the XYZ formula (Accomplished [X] as measured by [Y], by doing [Z]). "
            "Make it action-oriented and use strong verbs. Do not fabricate new facts or metrics. "
            "Do not start with greetings. Do not wrap the text in quotes.\n\n"
            f"Original Bullet:\n{req.text}"
        )

    improved_raw = await call_openrouter(api_key, model, system_prompt, user_prompt)
    improved_clean = improved_raw.strip()
    
    # Strip leading/trailing quotes if the model wrapped it in quotes
    if improved_clean.startswith('"') and improved_clean.endswith('"'):
        improved_clean = improved_clean[1:-1].strip()
    elif improved_clean.startswith("'") and improved_clean.endswith("'"):
        improved_clean = improved_clean[1:-1].strip()

    return {"improved_text": improved_clean}
