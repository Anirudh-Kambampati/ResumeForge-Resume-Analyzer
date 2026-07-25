"""Stage 4: Validation of LLM-generated resume parse output.

Responsibility:
  - Validate and repair LLM JSON output
  - Check for hallucinated facts (numeric claims, technologies, etc.)
  - Ensure the parsed data matches expected schema
  - NEVER call the LLM, extract text, or handle builder concerns

Stage-level logging:
  - Logs validation entry with output character count
  - Logs validation outcome (pass/repair/fail)
  - Logs structured error information for repair attempts
"""

import json
import logging
import re
from urllib.parse import urlparse
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("resumeforge.pipeline.validator")


# ============================================================
# Known platform domains — never put these in a portfolio field
# ============================================================

KNOWN_PLATFORM_DOMAINS: List[str] = [
    "github.com",
    "linkedin.com",
    "leetcode.com",
    "codeforces.com",
    "x.com",
    "twitter.com",
    "hackerrank.com",
]


# ============================================================
# JSON extraction and repair
# ============================================================


def clean_and_parse_json(raw: str) -> Dict[str, Any]:
    """Parse a JSON string from LLM output with multiple fallback strategies.

    Tries (in order):
      1. Direct json.loads
      2. Extract from markdown code block ```json ... ```
      3. Extract from first top-level { ... } block

    Returns:
        Parsed dictionary.

    Raises:
        ValueError: If no valid JSON could be extracted.
    """
    cleaned = raw.strip()

    # Strategy 1: Direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Markdown code block
    match_code_block = re.search(
        r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL | re.IGNORECASE
    )
    if match_code_block:
        try:
            return json.loads(match_code_block.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 3: First top-level braces block
    match_braces = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if match_braces:
        try:
            return json.loads(match_braces.group(1).strip())
        except json.JSONDecodeError:
            pass

    raise ValueError("Failed to extract valid JSON block from LLM response.")


# ============================================================
# Hallucination / claim validation
# ============================================================


def extract_numeric_claims(text: str) -> List[str]:
    """Extract numeric claims (percentages, counts, metrics) from text."""
    claims: List[str] = []
    matches = re.findall(r"\b\d+(?:[,.]\d+)*(?:\s*%|\s*percent)?\b", text, re.IGNORECASE)
    for match in matches:
        normalized = match.lower().replace(" percent", "%").replace(" ", "")
        claims.append(normalized)
    return claims


def validate_numeric_claims(
    original_text: str, improved_text: str, context: Optional[str] = None
) -> bool:
    """Verify improved text does not introduce numeric claims absent from source."""
    source = original_text + " " + (context or "")
    source_claims = extract_numeric_claims(source)
    improved_claims = extract_numeric_claims(improved_text)
    for claim in improved_claims:
        if claim not in source_claims:
            return False
    return True


# ============================================================
# Skill alias detection (subset of scoring_service aliases)
# ============================================================

SKILL_ALIASES: Dict[str, Tuple[str, ...]] = {
    "javascript": ("javascript", "js"),
    "typescript": ("typescript", "ts"),
    "react": ("react", "react.js"),
    "nextjs": ("nextjs", "next.js", "next js"),
    "nodejs": ("nodejs", "node.js", "node js"),
    "fastapi": ("fastapi", "fast api"),
    "postgresql": ("postgresql", "postgres"),
    "mongodb": ("mongodb", "mongo"),
    "machine learning": ("machine learning", "ml"),
    "large language models": ("large language models", "llm", "llms"),
    "retrieval augmented generation": ("retrieval augmented generation", "rag"),
    "scikit-learn": ("scikit-learn", "sklearn"),
}


def validate_generated_claims(
    original_text: str, improved_text: str, context: Optional[str] = None
) -> bool:
    """Reject measurable claims and named technologies absent from supplied evidence."""
    source = (original_text + " " + (context or "")).lower()

    # Check numeric claims
    if not validate_numeric_claims(original_text, improved_text, context):
        return False

    # Check skill/technology mentions
    for canonical, aliases in SKILL_ALIASES.items():
        generated_mentions = any(
            re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", improved_text, re.I)
            for alias in aliases
        )
        source_mentions = any(
            re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", source, re.I)
            for alias in aliases
        )
        if generated_mentions and not source_mentions:
            return False

    return True


# ============================================================
# Portfolio URL validation
# ============================================================


def is_likely_personal_website(url: str) -> bool:
    """Return True if the URL is a genuine personal website, not a known platform."""
    lower = url.lower().strip()
    try:
        with_proto = lower if re.match(r"^https?://", lower) else f"https://{lower}"
        hostname = re.sub(r"^www\.", "", urlparse(with_proto).hostname or "")
    except Exception:  # nosec
        return False

    return hostname not in KNOWN_PLATFORM_DOMAINS


# ====================================================================
# Validate the full parsed resume structure
# ====================================================================


def validate_parsed_structure(data: Dict[str, Any]) -> List[str]:
    """Validate the parsed resume JSON structure and return a list of issues.

    Returns an empty list if the structure is acceptable, otherwise a list of
    human-readable issue descriptions. This does NOT raise — callers decide
    how to handle issues (reject, warn, or accept).
    """
    issues: List[str] = []

    if not isinstance(data, dict):
        issues.append("Root value is not a JSON object.")
        return issues

    # Profile validation
    profile = data.get("profile", {})
    if not isinstance(profile, dict):
        issues.append("'profile' is not a JSON object.")
    else:
        if not profile.get("fullName"):
            issues.append("No 'fullName' found in profile — candidate name may be missing.")

        # Check portfolio URL isn't a known platform
        portfolio = profile.get("portfolio", "")
        if portfolio and not is_likely_personal_website(portfolio):
            issues.append(
                f"'portfolio' contains a known platform URL: {portfolio}. "
                "It should be moved to the appropriate profile field or removed."
            )

    # Check for empty top-level arrays (acceptable but may indicate poor extraction)
    for array_field in [
        "education",
        "experience",
        "projects",
        "skills",
        "achievements",
        "certifications",
        "languages",
        "research",
        "publications",
    ]:
        value = data.get(array_field, [])
        if not isinstance(value, list):
            issues.append(f"'{array_field}' is not an array.")

    return issues


def sanitize_parsed_resume(data: Dict[str, Any]) -> Dict[str, Any]:
    """Remove any builder UI fields that the LLM might have hallucinated.

    The import pipeline must NOT return builder-specific fields like
    sectionOrder, template, or layout. This function strips them if present.
    """
    builder_fields = {"sectionOrder", "section_order", "template", "layout", "id"}
    sanitized = {k: v for k, v in data.items() if k not in builder_fields}
    return sanitized
