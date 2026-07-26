"""Education Normalization — removes duplicated wording from education entries.

During PDF import, the LLM sometimes writes the field name into the degree string
multiple times.  For example:

  degree: "Bachelor of Technology, Computer Science and Engineering (Data Science) in Computer Science"
  field:  "Computer Science"

The phrase "in Computer Science" at the end duplicates information already present
in the `field` attribute *and* inside the "Computer Science and Engineering" portion
of the degree string.  This module detects and removes such duplication without
rewriting or inventing any content.

Only obvious duplicated text is removed.  Specialization, institution, GPA, and
graduation dates are never touched.
"""

import re
from typing import Any, Dict, List

# ============================================================
# Degree-prefix keywords — used to judge whether a string
# is a complete, standalone degree description.
# ============================================================

_STANDALONE_PREFIXES = frozenset({
    "bachelor", "master", "doctor", "phd",
    "bachelor of", "master of", "doctor of",
    "b.s.", "b.a.", "m.s.", "m.a.",
    "b.tech", "m.tech", "b.e.", "m.e.",
    "b.sc", "m.sc", "b.com", "m.com",
    "btech", "mtech", "mba",
    "associate", "diploma", "certificate",
    "bachelor's", "master's", "doctor's",
})


def _is_standalone_degree(text: str) -> bool:
    """Return True if *text* looks like a complete degree entry on its own."""
    low = text.lower().strip()
    for prefix in _STANDALONE_PREFIXES:
        if low.startswith(prefix):
            return True
    return any(kw in low for kw in ("bachelor", "master", "doctor", "phd"))


def _field_words_in_degree(degree: str, field: str) -> bool:
    """Return True if *field* words are substantially present in *degree*.

    For 2-word fields both words must appear; for 3+ word fields at least
    two thirds must appear.  This avoids false positives when a single word
    such as "Science" happens to appear in the degree name.
    """
    degree_lower = degree.lower()
    field_lower = field.lower()

    # Fast path: entire field string appears as a contiguous substring
    if field_lower in degree_lower:
        return True

    field_words = field_lower.split()
    if len(field_words) <= 1:
        return False

    matches = sum(1 for w in field_words if w in degree_lower)

    # 2-word fields: both words must appear
    if len(field_words) == 2:
        return matches == 2
    # 3+ word fields: at least two thirds
    return matches >= max(2, int(len(field_words) * 0.66))


def _clean_degree(degree: str, field: str) -> str:
    """Strip duplicated field references from the degree string.

    Detection order (most specific → least specific):

      1.  ``", <field> in <field>"`` at end
          →  remove ``" in <field>"`` keeping ``", <field>"``
          e.g. ``"B.Tech, Computer Science in Computer Science"`` → ``"B.Tech, Computer Science"``

      2.  ``" in <field>"`` at end, when the field words already appear elsewhere
          →  ``"B.Tech, Computer Science and Engineering (Data Science) in Computer Science"``
          → ``"B.Tech, Computer Science and Engineering (Data Science)"``

      3.  ``", <field>"`` at end, when the remainder is a standalone degree
          →  ``"B.S., Computer Science"`` → ``"B.S."``

    Args:
        degree: Raw degree string from the LLM.
        field:  Separately extracted field of study.

    Returns:
        Cleaned degree string with obvious duplication removed.
    """
    text = degree.strip()
    if not text or not field:
        return degree

    field_clean = field.strip()
    escaped = re.escape(field_clean)

    # ── Pattern 1: ", <field> in <field>" at end ────────────────
    #   Remove only the " in <field>" part, keeping ", <field>" so the
    #   specialization survives.
    text = re.sub(
        rf",\s*{escaped}\s+in\s+{escaped}\s*$",
        f", {field_clean}",
        text,
        flags=re.IGNORECASE,
    )

    # ── Pattern 2: trailing "in <field>" ──────────────────────────
    #   Only remove when the field words are already present earlier.
    candidate = re.sub(
        rf"\s+in\s+{escaped}\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    if candidate != text and _field_words_in_degree(candidate, field_clean):
        text = candidate

    # ── Pattern 3: trailing ", <field>" ────────────────────────────
    #   Only remove when the remaining string is a standalone degree.
    candidate = re.sub(
        rf",\s*{escaped}\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    if candidate != text and _is_standalone_degree(candidate):
        text = candidate

    return text.strip()


# ============================================================
# Public API
# ============================================================


def normalize_education(edu: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a single education dictionary."""

    result: Dict[str, Any] = dict(edu)
    degree = result.get("degree", "")
    field = result.get("field", "")

    if degree and isinstance(degree, str) and isinstance(field, str):
        result["degree"] = _clean_degree(degree, field)

    return result


def normalize_education_list(
    education_list: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Normalize every entry in an education list."""
    return [normalize_education(edu) for edu in education_list]
