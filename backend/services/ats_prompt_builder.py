"""ATS-optimized LLM prompt construction for resume parsing.

Responsibility:
  - Build system and user prompts for the LLM to parse raw resume text
    into structured data matching the frontend Resume type format
  - Emphasize ATS optimization: clean extraction artifacts, normalize
    formatting, preserve all keywords, do NOT fabricate content
  - Define the exact JSON output schema matching frontend types/resume.ts
    (without builder concerns like id, enabled, template, layout, sectionOrder)

Stage-level logging:
  - Logs prompt construction entry with text length
  - Logs built prompt size (character count)
"""

import logging
from typing import Dict, List, Optional, TypedDict

logger = logging.getLogger("resumeforge.pipeline.ats_prompt_builder")


# ============================================================
# Typed schema definitions matching frontend Resume type
# (see frontend/types/resume.ts)
#
# These omit builder-only fields: id, enabled, template,
# layout, sectionOrder, customSections.
# ============================================================


class ATSLink(TypedDict, total=False):
    label: str
    url: str
    username: str


class ATSProfile(TypedDict, total=False):
    fullName: str
    title: str
    titles: List[str]
    email: str
    phone: str
    location: str
    links: List[ATSLink]


class ATSSummary(TypedDict, total=False):
    text: str


class ATSSkillCategory(TypedDict, total=False):
    title: str
    items: List[str]


class ATSEducation(TypedDict, total=False):
    institution: str
    degree: str
    field: str
    grade: str
    startDate: str
    endDate: str


class ATSExperience(TypedDict, total=False):
    company: str
    role: str
    location: str
    startDate: str
    endDate: str
    currentlyWorking: bool
    bullets: List[str]


class ATSProject(TypedDict, total=False):
    title: str
    link: str
    technologies: List[str]
    bullets: List[str]


class ATSAchievement(TypedDict, total=False):
    title: str
    description: str


class ATSCertification(TypedDict, total=False):
    title: str
    issuer: str
    date: str
    credentialId: str


class ATSLanguage(TypedDict, total=False):
    name: str
    proficiency: str


class ATSResearch(TypedDict, total=False):
    title: str
    institution: str
    advisor: str
    duration: str
    link: str
    keywords: List[str]
    bullets: List[str]


class ATSPublication(TypedDict, total=False):
    title: str
    authors: str
    venue: str
    date: str
    doi: str
    keywords: List[str]
    description: str


class ATSResumeSchema(TypedDict, total=False):
    profile: ATSProfile
    summary: ATSSummary
    experience: List[ATSExperience]
    education: List[ATSEducation]
    skills: List[ATSSkillCategory]
    projects: List[ATSProject]
    achievements: List[ATSAchievement]
    certifications: List[ATSCertification]
    languages: List[ATSLanguage]
    research: List[ATSResearch]
    publications: List[ATSPublication]


def _build_ats_json_schema() -> str:
    """Return a human-readable ATS JSON schema for the LLM prompt."""
    return """{    "profile": {
    "fullName": "string (candidate's full name)",
    "title": "string (current or target professional title — single string, may contain ' | ', ' • ', etc.)",
    "titles": ["string (individual professional titles, split by separator — one per entry)"],
    "email": "string (email address — CLEAN, no prefixes like 'envelop~' or 'mailto:')",
    "phone": "string (phone number — CLEAN, no prefixes like 'telephone~' or 'call:')",
    "location": "string (city, state, country)",
    "links": [
      {
        "label": "string (platform name: 'LinkedIn', 'GitHub', 'Portfolio', 'X (Twitter)', etc.)",
        "url": "string (full URL with https://)",
        "username": "string (platform username, extracted from URL if possible)"
      }
    ]
  },
  "summary": {
    "text": "string (professional summary, exactly as written)"
  },
  "experience": [
    {
      "company": "string",
      "role": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string (empty string if currentlyWorking is true)",
      "currentlyWorking": "boolean",
      "bullets": ["string (each bullet point, one per item)"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string (e.g. Bachelor of Science)",
      "field": "string (e.g. Computer Science)",
      "grade": "string (GPA or score, if mentioned)",
      "startDate": "string",
      "endDate": "string"
    }
  ],
  "skills": [
    {
      "title": "string (category name, e.g. 'Programming Languages', 'Frameworks', 'Tools')",
      "items": ["string (individual skill)"]
    }
  ],
  "projects": [
    {
      "title": "string",
      "link": "string (project URL, if mentioned)",
      "technologies": ["string"],
      "bullets": ["string"]
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
      "date": "string",
      "credentialId": "string (optional)"
    }
  ],
  "languages": [
    {
      "name": "string",
      "proficiency": "string (e.g. Native, Fluent, Intermediate, Basic)"
    }
  ],
  "research": [
    {
      "title": "string",
      "institution": "string",
      "advisor": "string (optional)",
      "duration": "string (e.g. Jan 2024 - Present)",
      "link": "string (optional)",
      "keywords": ["string"],
      "bullets": ["string"]
    }
  ],
  "publications": [
    {
      "title": "string",
      "authors": "string",
      "venue": "string",
      "date": "string",
      "doi": "string (optional)",
      "keywords": ["string"],
      "description": "string"
    }
  ]
}"""


def build_ats_prompts(extracted_text: str) -> Dict[str, str]:
    """Build ATS-optimized system and user prompts for parsing a resume.

    Args:
        extracted_text: The raw text extracted from a PDF resume.

    Returns:
        Dict with 'system' and 'user' prompt strings.
    """
    logger.info(
        "[ATS-PROMPT] Building ATS prompts | text_length=%d",
        len(extracted_text),
    )

    system_prompt = (
        "You are a precise ATS-optimized resume parser. "
        "Your job is to extract, clean, and structure resume information "
        "from raw text in a format optimized for Applicant Tracking Systems.\n\n"
        "ATS OPTIMIZATION RULES:\n"
        "1. CLEAN EXTRACTION ARTIFACTS:\n"
        "   - Remove prefixes before contact info like 'envelop~', 'envelope~', "
        "'telephone~', 'phone~', 'mailto:', 'tel:', 'call:' before emails/phones.\n"
        "   - Remove garbled characters, replacement characters (�), and stray symbols "
        "that are PDF extraction artifacts.\n"
        "   - Normalize whitespace: collapse multiple spaces/newlines into single spaces.\n"
        "2. NORMALIZE FORMATTING:\n"
        "   - Standardize URLs: ensure they have https:// prefix when protocol is missing.\n"
        "   - Detect and categorize profile links into the 'links' array. Use these labels:\n"
        "       'LinkedIn'   → linkedin.com/in/username (profile only)\n"
        "       'GitHub'     → github.com/username     (profile only, NOT a repo)\n"
        "       'Portfolio'  → genuine personal website (e.g. firstname.dev). "
        "NEVER put deployment URLs (vercel.app, netlify.app, etc.), repo URLs "
        "(github.com/user/repo), or project-specific pages here.\n"
        "       'X (Twitter)' → x.com/username or twitter.com/username\n"
        "       'LeetCode', 'Codeforces', 'HackerRank' → competitive programming profiles\n"
        "   - If a URL does NOT match any known platform AND is not a genuine personal "
        "website, leave it out of profile.links entirely.\n"
        "3. PRESERVE CONTENT — DO NOT FABRICATE:\n"
        "   - Extract exactly what is written. Do NOT rephrase, embellish, or add facts, "
        "numbers, metrics, technologies, or job titles not explicitly present.\n"
        "   - Preserve all keywords, skills, and technologies exactly as written.\n"
        "   - Keep bullet points verbatim — only normalize whitespace.\n"
        "4. OUTPUT FORMAT:\n"
        "   - Output ONLY valid JSON matching the schema. No markdown, no code fences, no explanations.\n"
        "   - Empty fields should be empty strings or empty arrays as appropriate.\n"
        "   - Do NOT include id, enabled, template, layout, or sectionOrder fields."
    )

    schema = _build_ats_json_schema()

    user_prompt = (
        "Parse the following resume text into ATS-optimized structured data. "
        "Return ONLY valid JSON matching this schema:\n\n"
        f"{schema}\n\n"
        "RESUME TEXT:\n"
        "\"\"\"\n"
        f"{extracted_text}\n"
        "\"\"\"\n\n"
        "CRITICAL REMINDERS:\n"
        "- Strip PDF extraction garbage (e.g. 'envelop~' before emails, 'telephone~' before phones)\n"
        "- Detect and categorize links properly:\n"
        "   PROFILE links go in profile.links: LinkedIn, GitHub (profile only), Portfolio "
        "(personal website only), X (Twitter), LeetCode, Codeforces, HackerRank\n"
        "   PROJECT links stay in projects[].link: GitHub repo URLs, Live Demo URLs, "
        "deployment URLs (vercel.app, netlify.app, etc.)\n"
        "   NEVER put a project link (repo, deployment, demo) in profile.links!\n"
        "   NEVER put a platform profile URL (linkedin, github profile) in a project link!\n"
        "- Preserve all original content — do NOT invent anything\n"
        "- Normalize whitespace only — do not rewrite sentences\n"
        "- Output ONLY valid JSON — no markdown, no code blocks, no commentary"
    )

    logger.info(
        "[ATS-PROMPT] Built ATS prompts | system_length=%d | user_length=%d",
        len(system_prompt),
        len(user_prompt),
    )

    return {
        "system": system_prompt,
        "user": user_prompt,
    }
