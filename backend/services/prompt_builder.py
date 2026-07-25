"""Stage 2: LLM Prompt Construction for resume parsing.

Responsibility:
  - Build system and user prompts for the LLM to parse raw resume text
  - Define the expected JSON output schema for parsed resumes
  - NEVER call the LLM, validate output, or handle builder concerns

Stage-level logging:
  - Logs prompt construction entry with text length
  - Logs built prompt size (character count)
"""

import logging
from typing import Dict, List, Optional, TypedDict

logger = logging.getLogger("resumeforge.pipeline.prompt_builder")


# ============================================================
# Typed schema definitions for LLM output
# These are pure data — no builder UI concerns (no sectionOrder,
# template, layout, etc.)
# ============================================================


class ParsedProfile(TypedDict, total=False):
    fullName: str
    title: str
    email: str
    phone: str
    location: str
    linkedin: str
    github: str
    portfolio: str


class ParsedEducation(TypedDict, total=False):
    degree: str
    institution: str
    location: str
    startDate: str
    endDate: str
    gpa: str


class ParsedExperience(TypedDict, total=False):
    company: str
    role: str
    location: str
    startDate: str
    endDate: str
    currentlyWorking: bool
    bullets: List[str]


class ParsedProject(TypedDict, total=False):
    title: str
    technologies: List[str]
    description: str
    link: str


class ParsedSkillCategory(TypedDict, total=False):
    category: str
    items: List[str]


class ParsedAchievement(TypedDict, total=False):
    title: str
    description: str


class ParsedCertification(TypedDict, total=False):
    title: str
    issuer: str
    date: str


class ParsedLanguage(TypedDict, total=False):
    name: str
    proficiency: str


class ParsedResearch(TypedDict, total=False):
    title: str
    institution: str
    description: str


class ParsedPublication(TypedDict, total=False):
    title: str
    authors: str
    venue: str
    date: str
    description: str


class ParsedResumeSchema(TypedDict, total=False):
    profile: ParsedProfile
    summary: str
    education: List[ParsedEducation]
    experience: List[ParsedExperience]
    projects: List[ParsedProject]
    skills: List[ParsedSkillCategory]
    achievements: List[ParsedAchievement]
    certifications: List[ParsedCertification]
    languages: List[ParsedLanguage]
    research: List[ParsedResearch]
    publications: List[ParsedPublication]


def _build_json_schema_doc() -> str:
    """Return a human-readable JSON schema description for the LLM prompt."""
    return """{
  "profile": {
    "fullName": "string (the candidate's full name)",
    "title": "string (current or target professional title)",
    "email": "string (email address)",
    "phone": "string (phone number)",
    "location": "string (city, state/country)",
    "linkedin": "string (full LinkedIn URL)",
    "github": "string (full GitHub URL)",
    "portfolio": "string (full portfolio/website URL — NOT a GitHub/LinkedIn/LeetCode URL)"
  },
  "summary": "string (professional summary text, exactly as written)",
  "education": [
    {
      "degree": "string (e.g. BS Computer Science)",
      "institution": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string (if mentioned, optional)"
    }
  ],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string (empty string if currentlyWorking is true)",
      "currentlyWorking": "boolean",
      "bullets": ["string (each bullet point)"]
    }
  ],
  "projects": [
    {
      "title": "string",
      "technologies": ["string"],
      "description": "string (full description of the project)",
      "link": "string (project URL, if mentioned)"
    }
  ],
  "skills": [
    {
      "category": "string (e.g. Languages, Frameworks, Tools)",
      "items": ["string"]
    }
  ],
  "achievements": [
    {
      "title": "string",
      "description": "string"
    }
  ],
  "certifications": [
    {
      "title": "string",
      "issuer": "string",
      "date": "string"
    }
  ],
  "languages": [
    {
      "name": "string",
      "proficiency": "string (e.g. Native, Fluent, Intermediate)"
    }
  ],
  "research": [
    {
      "title": "string",
      "institution": "string",
      "description": "string"
    }
  ],
  "publications": [
    {
      "title": "string",
      "authors": "string",
      "venue": "string",
      "date": "string",
      "description": "string"
    }
  ]
}"""


def build_parse_prompts(extracted_text: str) -> Dict[str, str]:
    """Build system and user prompts for parsing a resume from raw text.

    Args:
        extracted_text: The raw text extracted from a PDF resume.

    Returns:
        Dict with 'system' and 'user' prompt strings.
    """
    logger.info(
        "[PROMPT] Building parse prompts | text_length=%d",
        len(extracted_text),
    )

    system_prompt = (
        "You are a precise resume information extractor. "
        "Your job is to extract structured information from resume text. "
        "Do NOT invent facts, numbers, metrics, technologies, or job titles "
        "that are not explicitly present in the provided text. "
        "Do NOT add portfolio URLs that match known platforms "
        "(e.g. github.com, linkedin.com, leetcode.com, etc.) "
        "Only use the 'portfolio' field for genuine personal websites. "
        "Extract exactly what is written — do not rephrase or embellish. "
        "If a field is not present in the text, leave it as an empty string "
        "or empty array as appropriate. "
        "Output ONLY valid JSON. No markdown, no explanations."
    )

    schema_doc = _build_json_schema_doc()

    user_prompt = (
        "Extract structured resume data from the following text. "
        "Return ONLY valid JSON matching this schema:\n\n"
        f"{schema_doc}\n\n"
        "RESUME TEXT:\n"
        '"""\n'
        f"{extracted_text}\n"
        '"""\n\n'
        "Rules:\n"
        "1. Do NOT fabricate any information not present in the text.\n"
        "2. Do NOT add portfolio URLs for known platforms (GitHub, LinkedIn, LeetCode, etc.).\n"
        "3. If contact URLs are full URLs, preserve them exactly.\n"
        "4. Extract bullet points as individual strings in the bullets array.\n"
        "5. Leave fields absent from the text as empty strings or empty arrays.\n"
        "6. Output ONLY valid JSON — no markdown code blocks, no commentary."
    )

    logger.info(
        "[PROMPT] Built prompts | system_length=%d | user_length=%d",
        len(system_prompt),
        len(user_prompt),
    )

    return {
        "system": system_prompt,
        "user": user_prompt,
    }


def build_repair_prompt(raw_output: str, error_detail: str) -> Dict[str, str]:
    """Build prompts for repairing malformed LLM JSON output.

    Args:
        raw_output: The raw (invalid) text the LLM returned.
        error_detail: Description of the JSON parse error.

    Returns:
        Dict with 'system' and 'user' prompt strings.
    """
    system_prompt = (
        "You are a JSON correction assistant. "
        "Fix the given JSON and return ONLY valid JSON. No markdown, no explanations."
    )

    user_prompt = (
        f"ERROR: {error_detail}\n\n"
        f"INVALID OUTPUT:\n"
        f"{raw_output}\n\n"
        "Correct this to output ONLY valid JSON matching the original schema. "
        "Do not change the data, only fix the formatting."
    )

    return {"system": system_prompt, "user": user_prompt}
