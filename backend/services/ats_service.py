"""ATS Optimization LLM Layer — receives extracted resume text and returns
structured data matching the frontend Resume type (ATS-optimized).

Pipeline stages:
  1. PROMPT   →  ats_prompt_builder.build_ats_prompts()
  2. LLM      →  llm_client.chat_completion()
  3. VALIDATE →  JSON parsing + structure validation + sanitization
  4. CLEAN    →  Post-processing: normalize contact info, link detection, cleanup

Key design constraints:
  - NEVER adds fabricated content (no hallucinated metrics, skills, titles)
  - REMOVES extraction artifacts (e.g. 'envelop~' before emails)
  - Always outputs schema matching frontend types/resume.ts (no builder fields)
  - Stage-level logging for traceability
"""

import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from services.llm_client import LLMClient
from services.ats_prompt_builder import build_ats_prompts
from services.certification_normalizer import normalize_certifications
from services.date_normalizer import normalize_single_date
from services.achievement_normalizer import normalize_achievements
from services.project_normalizer import normalize_projects
from services.education_normalizer import normalize_education_list
from services.skill_normalizer import normalize_skill_items
from services.validator import (
    clean_and_parse_json,
    is_likely_personal_website,
    KNOWN_PLATFORM_DOMAINS,
)

logger = logging.getLogger("resumeforge.pipeline.ats_service")


# ============================================================
# Known platform domains — used for link categorization
# ============================================================

PLATFORM_DETECTORS: Dict[str, List[re.Pattern]] = {
    "LinkedIn": [
        re.compile(r"linkedin\.com/(?:in|company|school)/([^\/?#&]+)", re.I),
    ],
    "GitHub": [
        re.compile(r"github\.com/([^\/?#&\s]+)", re.I),
    ],
    "X (Twitter)": [
        re.compile(r"x\.com/([^\/?#&\s]+)", re.I),
        re.compile(r"twitter\.com/([^\/?#&\s]+)", re.I),
    ],
    "LeetCode": [
        re.compile(r"leetcode\.com/u/([^\/?#&\s]+)", re.I),
        re.compile(r"leetcode\.com/([^\/?#&\s]+)", re.I),
    ],
    "Codeforces": [
        re.compile(r"codeforces\.com/profile/([^\/?#&\s]+)", re.I),
    ],
    "HackerRank": [
        re.compile(r"hackerrank\.com/(?:profile/)?([^\/?#&\s]+)", re.I),
    ],
}

# ============================================================
# Post-processing: link detection and normalization
# ============================================================


def _detect_platform(url: str) -> Optional[str]:
    """Detect which platform a URL belongs to."""
    cleaned = url.strip().lower()
    for platform, patterns in PLATFORM_DETECTORS.items():
        for pattern in patterns:
            if pattern.search(cleaned):
                return platform
    return None


def _extract_username(url: str, platform: str) -> str:
    """Extract username from a known platform URL."""
    for pattern in PLATFORM_DETECTORS.get(platform, []):
        match = pattern.search(url)
        if match:
            return match.group(1)
    return ""


def _normalize_url(url: str) -> str:
    """Ensure URL has https:// prefix."""
    url = url.strip()
    if not url:
        return ""
    if re.match(r"^https?://", url, re.I):
        return url
    if url.startswith("www."):
        return f"https://{url}"
    # Check if it looks like a domain
    if "." in url and not url.startswith("/"):
        return f"https://{url}"
    return url



def _split_titles(raw: str) -> List[str]:
    """Split a raw title string into multiple titles by common separators.

    Recognized separators:  |  •  /  ·
    Trims whitespace, ignores empty entries, deduplicates via insertion-order dict.
    """
    if not raw or not raw.strip():
        return []
    parts = [p.strip() for p in re.split(r"\s*[|•\/·]\s*", raw) if p.strip()]
    # Deduplicate preserving order
    seen: set = set()
    result: List[str] = []
    for p in parts:
        if p.lower() not in seen:
            seen.add(p.lower())
            result.append(p)
    return result


def _postprocess_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Clean and normalize profile fields."""
    cleaned = dict(profile)

    # Title → titles: split canonical title if present and populate titles array
    raw_title = cleaned.get("title", "")
    raw_titles = cleaned.get("titles", [])
    if isinstance(raw_titles, list) and len(raw_titles) > 0:
        # Already have titles array—just ensure non-empty strings
        cleaned["titles"] = [t.strip() for t in raw_titles if isinstance(t, str) and t.strip()]
    elif raw_title and isinstance(raw_title, str):
        # Split the single title field into titles
        cleaned["titles"] = _split_titles(raw_title)
    else:
        cleaned["titles"] = []

    # Preserve raw title for backward compatibility with the import pipeline
    # (atsImport.ts uses it as the source for splitting)
    cleaned["title"] = raw_title

    # Clean email: remove 'envelop~', 'envelope~', 'mailto:', and similar prefixes
    email = cleaned.get("email", "")
    if email:
        email = re.sub(
            r"^(?:\s*(?:envelop|envelope|email)\s*[~:\-–—]?\s*)+",
            "",
            email,
            flags=re.IGNORECASE,
        )
        email = re.sub(r"^mailto:", "", email, flags=re.IGNORECASE)
        email = email.strip()
        cleaned["email"] = email

    # Clean phone: remove 'telephone~', 'phone~', 'call:', 'tel:' prefixes
    phone = cleaned.get("phone", "")
    if phone:
        phone = re.sub(
            r"^(?:\s*(?:telephone|phone|tel|call)\s*[~:\-–—]?\s*)+",
            "",
            phone,
            flags=re.IGNORECASE,
        )
        phone = phone.strip()
        cleaned["phone"] = phone

    # Process links — classify each URL with strict priority
    raw_links: List[Dict[str, Any]] = cleaned.get("links", [])
    normalized_links: List[Dict[str, Any]] = []
    seen_urls: set = set()

    for link in raw_links:
        if not isinstance(link, dict):
            continue
        url = link.get("url", "")
        if not url:
            continue
        url = _normalize_url(url)
        if url in seen_urls:
            continue
        seen_urls.add(url)

        label = link.get("label", "")
        username = link.get("username", "")

        # Step 1 — always detect known platforms first (LinkedIn, GitHub, etc.)
        detected_platform = _detect_platform(url)

        # Step 2 — classify based on URL structure and detected platform
        if detected_platform:
            # Known platform → use its label
            label = detected_platform
        else:
            # Unknown platform: decide between Portfolio and rejecting the link
            if is_likely_personal_website(url):
                # Only label as Portfolio if it passes ALL strict checks
                # (no known platform domain, no deployment domain, no repo path)
                label = "Portfolio"
            else:
                # Not a personal website, not a known platform.
                # This could be a project link, deployment, or unrelated URL.
                # Do NOT add it to profile links — it doesn't belong here.
                # If it's a valid URL, still add it but mark it generically
                # so the frontend can re-classify it.
                label = link.get("label", "Link")

        # Extract username if missing (only for known platforms)
        if not username and detected_platform:
            username = _extract_username(url, detected_platform)

        normalized_links.append({
            "label": label or "Link",
            "url": url,
            "username": username or "",
        })

    cleaned["links"] = normalized_links
    return cleaned


def _postprocess_summary(summary: Any) -> Dict[str, str]:
    """Normalize summary field."""
    if isinstance(summary, str):
        return {"text": summary.strip()}
    if isinstance(summary, dict):
        text = summary.get("text", summary.get("content", ""))
        return {"text": text.strip()}
    return {"text": ""}


def _ensure_list(data: Any) -> list:
    """Ensure value is a list."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


# ============================================================
# Section ordering — consistent layout for all imported resumes
# ============================================================

# Preferred order after import.  Sections not in this list are
# appended in their original order at the end.
_PREFERRED_SECTION_ORDER = [
    "profile",       # Header
    "summary",       # Professional Summary
    "experience",
    "projects",
    "education",
    "skills",
    "certifications",
    "achievements",
    "languages",
    "research",
    "publications",
]


def _reorder_sections(data: Dict[str, Any]) -> Dict[str, Any]:
    """Reorder top-level sections to follow the preferred layout.

    Only sections present in *data* are included — missing sections
    are silently skipped.  Any extra keys not in the preferred list
    (e.g. LLM-hallucinated fields) are appended in their original order.

    Args:
        data: The parsed resume dict (keys are section names).

    Returns:
        A new dict with the same keys in the preferred order.
    """
    ordered: Dict[str, Any] = {}

    # Place known sections in preferred order
    for key in _PREFERRED_SECTION_ORDER:
        if key in data:
            ordered[key] = data[key]

    # Append any remaining keys that weren't in the preferred list
    for key in data:
        if key not in _PREFERRED_SECTION_ORDER:
            ordered[key] = data[key]

    return ordered


# ============================================================
# Main entry point
# ============================================================


async def run_ats_optimization(
    extracted_text: str,
    llm_client: LLMClient,
    max_retries: int = 1,
) -> Dict[str, Any]:
    """Run the ATS optimization pipeline on extracted resume text.

    Args:
        extracted_text: The cleaned text from PDF extraction.
        llm_client: Configured LLMClient instance.
        max_retries: Number of times to retry on validation failure.

    Returns:
        Dict with structured resume data matching the frontend Resume type
        (without builder concerns: id, enabled, template, layout, sectionOrder).

    Raises:
        HTTPException: With detailed error message on failure.
    """
    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Cannot optimize empty resume text.",
        )

    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="AI service is not configured. Cannot perform ATS optimization.",
        )

    logger.info(
        "[ATS] Starting ATS optimization | text_chars=%d",
        len(extracted_text),
    )

    # ============================================================
    # Stage 1: Build ATS-optimized prompts
    # ============================================================
    prompts = build_ats_prompts(extracted_text)
    logger.info(
        "[ATS] Stage 1 (PROMPT) built | system=%d chars | user=%d chars",
        len(prompts["system"]),
        len(prompts["user"]),
    )

    # ============================================================
    # Stage 2: LLM call with optional retry
    # ============================================================
    raw_output = ""
    parsed_data: Dict[str, Any] = {}
    parse_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        if attempt == 0:
            logger.info("[ATS] Stage 2 (LLM) — initial request | attempt=%d", attempt + 1)
            try:
                raw_output = await llm_client.chat_completion(
                    prompts["system"],
                    prompts["user"],
                    temperature=0.15,  # Low temp for deterministic extraction
                )
            except HTTPException:
                raise
        else:
            logger.warning(
                "[ATS] Stage 2 (LLM) — repair retry | attempt=%d",
                attempt + 1,
            )
            repair_prompt = (
                f"ERROR: {parse_error}\n\n"
                f"INVALID OUTPUT:\n{raw_output}\n\n"
                "Fix this JSON. Return ONLY valid JSON. "
                "Do NOT change the data, only fix formatting issues."
            )
            try:
                raw_output = await llm_client.chat_completion(
                    "You are a JSON correction assistant. Output ONLY valid JSON — no markdown, no explanations.",
                    repair_prompt,
                    temperature=0.1,
                )
            except HTTPException:
                raise

        # ============================================================
        # Stage 3: JSON parsing
        # ============================================================
        try:
            parsed_data = clean_and_parse_json(raw_output)
            parse_error = None
        except ValueError as exc:
            parse_error = exc
            logger.error(
                "[ATS] Stage 3 (PARSE) failed | attempt=%d | error=%s",
                attempt + 1,
                str(exc),
            )
            if attempt < max_retries:
                continue
            raise HTTPException(
                status_code=502,
                detail=f"ATS optimization failed: AI model returned invalid JSON. {exc}",
            ) from exc

        # Validate root structure
        if not isinstance(parsed_data, dict):
            parse_error = ValueError("Root value is not a JSON object.")
            if attempt < max_retries:
                continue
            raise HTTPException(
                status_code=502,
                detail="ATS optimization failed: AI model returned a non-object value.",
            )

        # If we got here, parsing succeeded
        break

    # ============================================================
    # Stage 4: Post-processing and cleanup
    # ============================================================
    logger.info("[ATS] Stage 4 (POST-PROCESS) — cleaning and normalizing")

    # Profile
    if "profile" in parsed_data and isinstance(parsed_data["profile"], dict):
        parsed_data["profile"] = _postprocess_profile(parsed_data["profile"])

    # Summary
    if "summary" in parsed_data:
        parsed_data["summary"] = _postprocess_summary(parsed_data["summary"])

    # Experience — normalize dates
    if "experience" in parsed_data:
        parsed_data["experience"] = _ensure_list(parsed_data["experience"])
        for exp in parsed_data["experience"]:
            if isinstance(exp, dict):
                exp["startDate"] = normalize_single_date(exp.get("startDate", ""))
                exp["endDate"] = normalize_single_date(exp.get("endDate", ""))
                exp["bullets"] = _ensure_list(exp.get("bullets", []))
                exp["bullets"] = [b.strip() for b in exp["bullets"] if b.strip()]

    # Skills — normalize formatting, deduplicate, preserve categories
    if "skills" in parsed_data:
        parsed_data["skills"] = _ensure_list(parsed_data["skills"])
        for skill in parsed_data["skills"]:
            if isinstance(skill, dict):
                raw_items = _ensure_list(skill.get("items", []))
                # Normalize each skill name: fix PascalCase, hyphens, parentheses, whitespace
                skill["items"] = normalize_skill_items(raw_items)

    # Projects — split title|techs, deduplicate technologies
    if "projects" in parsed_data:
        parsed_data["projects"] = normalize_projects(
            _ensure_list(parsed_data["projects"])
        )
        for proj in parsed_data["projects"]:
            if isinstance(proj, dict):
                proj["bullets"] = [b.strip() for b in _ensure_list(proj.get("bullets", [])) if b.strip()]

    # Research — normalize dates
    if "research" in parsed_data:
        parsed_data["research"] = _ensure_list(parsed_data["research"])
        for res in parsed_data["research"]:
            if isinstance(res, dict):
                res["duration"] = normalize_single_date(res.get("duration", ""))
                res["keywords"] = [k.strip() for k in _ensure_list(res.get("keywords", [])) if k.strip()]
                res["bullets"] = [b.strip() for b in _ensure_list(res.get("bullets", [])) if b.strip()]

    # Publications — normalize dates
    if "publications" in parsed_data:
        parsed_data["publications"] = _ensure_list(parsed_data["publications"])
        for pub in parsed_data["publications"]:
            if isinstance(pub, dict):
                pub["date"] = normalize_single_date(pub.get("date", ""))
                pub["keywords"] = [k.strip() for k in _ensure_list(pub.get("keywords", [])) if k.strip()]

    # Certifications — remove duplicated issuer from titles, normalize dates
    if "certifications" in parsed_data:
        parsed_data["certifications"] = normalize_certifications(
            _ensure_list(parsed_data["certifications"])
        )
        for cert in parsed_data["certifications"]:
            if isinstance(cert, dict):
                cert["date"] = normalize_single_date(cert.get("date", ""))

    # Achievements — parse bullet-separated text into individual strings
    if "achievements" in parsed_data:
        parsed_data["achievements"] = normalize_achievements(parsed_data["achievements"])

    # Languages
    if "languages" in parsed_data:
        parsed_data["languages"] = _ensure_list(parsed_data["languages"])

    # Education — normalize dates and remove duplicated field references
    if "education" in parsed_data:
        parsed_data["education"] = normalize_education_list(
            _ensure_list(parsed_data["education"])
        )
        for edu in parsed_data["education"]:
            if isinstance(edu, dict):
                edu["startDate"] = normalize_single_date(edu.get("startDate", ""))
                edu["endDate"] = normalize_single_date(edu.get("endDate", ""))

    # Reorder sections to preferred layout (consistent import order)
    parsed_data = _reorder_sections(parsed_data)

    # Strip builder-only fields if LLM hallucinated them
    BUILDER_FIELDS = {"id", "enabled", "template", "layout", "sectionOrder", "customSections"}
    parsed_data = {k: v for k, v in parsed_data.items() if k not in BUILDER_FIELDS}

    logger.info(
        "[ATS] Optimization complete | sections=%s",
        [k for k, v in parsed_data.items() if v],
    )

    return parsed_data
