"""Date Normalization — consistent date formatting across resumes.

Normalizes all date strings to "Mon YYYY" format (e.g. "Jun 2027").
Preserves special keywords: Present, Expected.
Normalizes "Current" → "Present".
Does NOT infer missing dates — only reformats what's given.
"""

import re
from typing import Dict, Set

# ============================================================
# Month aliases: full names and abbreviations → 3-letter canonical form
# ============================================================

_MONTH_ALIASES: Dict[str, str] = {
    "jan": "Jan", "january": "Jan",
    "feb": "Feb", "february": "Feb",
    "mar": "Mar", "march": "Mar",
    "apr": "Apr", "april": "Apr",
    "may": "May",
    "jun": "Jun", "june": "Jun",
    "jul": "Jul", "july": "Jul",
    "aug": "Aug", "august": "Aug",
    "sep": "Sep", "september": "Sep",
    "oct": "Oct", "october": "Oct",
    "nov": "Nov", "november": "Nov",
    "dec": "Dec", "december": "Dec",
}

# Regex patterns (compiled once)
_SINGLE_DATE_RE = re.compile(r"^(\d{1,2})/(\d{4})$")            # 06/2027
_MONTH_YEAR_RE = re.compile(r"^([A-Za-z]+)\s+(\d{4})$")         # Jun 2027 or June 2027
_YEAR_ONLY_RE = re.compile(r"^\d{4}$")                           # 2027
_DURATION_SEP_RE = re.compile(r"\s*(?:–|-|—|to)\s*", re.IGNORECASE)  # separator in date ranges


def _month_num_to_abbrev(n: int) -> str:
    """Map numeric month (1–12) to 3-letter abbreviation."""
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return months[n - 1] if 1 <= n <= 12 else ""


def _normalize_month(word: str) -> str | None:
    """Parse a month name/abbreviation to its 3-letter canonical form, or None."""
    return _MONTH_ALIASES.get(word.lower())


def normalize_single_date(date: str) -> str:
    """Normalize ONE date string.

    Handles:
      "Jun 2027"     → "Jun 2027"
      "June 2027"    → "Jun 2027"
      "06/2027"      → "Jun 2027"
      "2027"         → "2027"
      "Present"      → "Present"
      "Current"      → "Present"
      "Expected Jun 2027" → "Expected Jun 2027"
      ""             → ""
    """
    text = date.strip()
    if not text:
        return ""

    lower = text.lower()

    # 1. Special keywords (standalone)
    if lower == "present" or lower == "current":
        return "Present"
    if lower == "expected":
        return "Expected"

    # 2. "Expected <date>" prefix
    prefix = ""
    body = text
    expected_match = re.match(r"^expected\s+", text, re.IGNORECASE)
    if expected_match:
        prefix = "Expected "
        body = text[expected_match.end():].strip()

    # 3. MM/YYYY
    slash_match = _SINGLE_DATE_RE.match(body)
    if slash_match:
        month_num = int(slash_match.group(1))
        year = slash_match.group(2)
        if 1 <= month_num <= 12:
            return prefix + f"{_month_num_to_abbrev(month_num)} {year}"
        return prefix + body

    # 4. "Month YYYY"
    month_year_match = _MONTH_YEAR_RE.match(body)
    if month_year_match:
        canonical = _normalize_month(month_year_match.group(1))
        if canonical:
            return prefix + f"{canonical} {month_year_match.group(2)}"

    # 5. Just "YYYY"
    if _YEAR_ONLY_RE.match(body):
        return prefix + body

    # 6. Fallback
    return prefix + body


def normalize_date(value: str) -> str:
    """Normalize a single date OR an entire duration range string.

    Handles:
      "June 2023 – Present"     → "Jun 2023 – Present"
      "June 2023 - June 2025"  → "Jun 2023 – Jun 2025"
      "June 2023 — June 2025"  → "Jun 2023 – Jun 2025"
      "Jun 2023 to Present"    → "Jun 2023 – Present"
      "Expected June 2027"     → "Expected Jun 2027"
    """
    text = value.strip()
    if not text:
        return ""

    # Try splitting on common range separators
    parts = _DURATION_SEP_RE.split(text)
    if len(parts) >= 2:
        normalized = [
            normalize_single_date(p.strip())
            for p in parts
            if p.strip()
        ]
        return " – ".join(normalized)

    # Single date — just normalize
    return normalize_single_date(text)
