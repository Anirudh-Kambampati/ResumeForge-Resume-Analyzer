"""Project Normalization — separates project title from embedded technologies.

During PDF import the LLM sometimes writes the tech stack directly into
the project title separated by a pipe character:

  title:  "ResumeForge | Next.js, FastAPI, Python"
  → title:  "ResumeForge"
    technologies: ["Next.js", "FastAPI", "Python"]

Only the portion before the pipe is kept as the title.  The rest is
parsed into individual technologies, merged with any separately extracted
technologies, deduplicated, and returned as the final list.
"""

import re
from typing import Any, Dict, List, Set

_TECH_SEP_RE = re.compile(r"\s*[,;]\s*")  # comma- or semicolon-separated values


def _parse_techs(raw: str) -> List[str]:
    """Parse a raw technology string into individual items."""
    items = _TECH_SEP_RE.split(raw)
    return [t.strip() for t in items if t.strip()]


def _ensure_techs(value: Any) -> List[str]:
    """Normalize technologies field to a list of stripped strings.

    Handles the case where the LLM returns a comma-separated string
    instead of a JSON array.
    """
    if isinstance(value, str):
        return [v.strip() for v in _TECH_SEP_RE.split(value) if v.strip()]
    if isinstance(value, list):
        return [str(t).strip() for t in value if t]
    return []


def normalize_project(proj: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a single project entry, splitting title | techs if needed."""
    result: Dict[str, Any] = dict(proj)
    title = result.get("title", "")
    existing_techs = _ensure_techs(result.get("technologies"))

    if not isinstance(title, str) or not title.strip():
        return result

    # Look for a pipe or bullet separator in the title
    sep_match = re.search(r"\s*(?:[|•])\s*", title)
    if not sep_match:
        result["technologies"] = existing_techs
        return result  # nothing to split

    before = title[: sep_match.start()].strip()
    after = title[sep_match.end():].strip()

    if not before:
        result["technologies"] = existing_techs
        return result  # nothing usable before the separator

    # The part before the separator becomes the new title
    result["title"] = before

    # Parse technologies from the part after the separator
    new_techs = _parse_techs(after)

    # Merge with existing technologies, deduplicate case-insensitively
    all_techs = existing_techs + new_techs
    seen: Set[str] = set()
    merged: List[str] = []
    for t in all_techs:
        t = t.strip()
        if not t:
            continue
        key = t.lower()
        if key not in seen:
            seen.add(key)
            merged.append(t)

    result["technologies"] = merged
    return result


def normalize_projects(project_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize every entry in a projects list."""
    return [normalize_project(p) for p in project_list]
