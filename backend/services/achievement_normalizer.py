"""Achievement Normalization — parses bullet-separated achievement text into
individual achievement strings.

The LLM sometimes returns the entire Achievements section as a single paragraph
or as a bullet-heavy string that hasn't been split into individual items.  This
module detects bullet markers (•, -, *, numbered lists) and splits accordingly,
merging continuation lines into their parent achievement.

Input can be:
  - A single multi-line string with bullet markers
  - A list of strings (some of which may contain embedded bullets)
  - A list of {title, description} objects

Output is always a clean list of strings, one per achievement, with bullet
glyphs removed and continuation lines merged.
"""

import re
from typing import Any, Dict, List

_BULLET_GENERIC = re.compile(r"^\s*[•●▪◦*\-–—›·♦→✓✔✗✘✦✧⬩▸▹►▪▫○●□■▲△▶▷▼▽◀◁◆◇○●]")
_BULLET_NUMBERED = re.compile(r"^\s*\d+[.)]")
_BULLET_LETTERED = re.compile(r"^\s*[a-zA-Z][.)]")


def _is_bullet_line(line: str) -> bool:
    """Check if a line starts with a recognised bullet marker."""
    return bool(
        _BULLET_GENERIC.match(line)
        or _BULLET_NUMBERED.match(line)
        or _BULLET_LETTERED.match(line)
    )


def _strip_bullet(text: str) -> str:
    """Remove the leading bullet glyph (and its trailing whitespace) from text."""
    for pattern in (_BULLET_GENERIC, _BULLET_NUMBERED, _BULLET_LETTERED):
        m = pattern.match(text)
        if m:
            return text[m.end():].strip()
    return text.strip()


def _split_bullet_text(raw: str) -> List[str]:
    """Split a multi-line string on bullet markers, merging continuation lines.

    A "continuation line" is any non-empty line that does NOT start with a
    bullet marker.  It is appended to the current (most recent) achievement.

    Args:
        raw: A multi-line string that may contain bullet markers.

    Returns:
        A list of achievement strings with bullets removed and lines merged.
    """
    lines = raw.split("\n")
    achievements: List[str] = []
    current: List[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            # Blank line — flush current achievement if we have content
            if current:
                achievements.append(" ".join(current))
                current = []
            continue

        if _is_bullet_line(stripped):
            # Flush any previous accumulation
            if current:
                achievements.append(" ".join(current))
            # Start a new achievement with bullet removed
            current = [_strip_bullet(stripped)]
        elif current:
            # Continuation line — append to current achievement
            current.append(stripped)
        else:
            # Content before first bullet — treat as its own achievement
            current.append(stripped)

    # Flush last accumulation
    if current:
        achievements.append(" ".join(current))

    return achievements


def _normalize_achievement_text(text: str) -> str:
    """Clean a single achievement string.

    - Collapse internal whitespace (newlines, multiple spaces → single space)
    - Strip leading/trailing whitespace
    """
    return " ".join(text.split()).strip()


def normalize_achievements(
    achievements: Any,
) -> List[str]:
    """Normalize achievements into a clean list of strings.

    Handles all input shapes the LLM may produce:

      * **Single string** — treat as multi-line bullet text, split on markers.
      * **List of strings** — check each string for embedded bullets; if found,
        split that string further.  Otherwise use as-is.
      * **List of objects** (``{title, description}``) — merge ``title`` and
        ``description`` into a single string per achievement.
      * **Empty / None** — return empty list.

    Output guarantees:
      - Each item is one complete achievement (title + description merged).
      - No bullet glyphs in output.
      - Continuation lines are merged into the owning achievement.
      - Whitespace is normalised (no double spaces, no leading/trailing spaces).
      - Empty items are omitted.
    """
    if not achievements:
        return []

    # -- Case 1: single string -----------------------------------------------
    if isinstance(achievements, str):
        parts = _split_bullet_text(achievements)
        return [
            _normalize_achievement_text(p)
            for p in parts
            if _normalize_achievement_text(p)
        ]

    # -- Case 2: list --------------------------------------------------------
    if isinstance(achievements, list):
        result: List[str] = []

        for item in achievements:
            if isinstance(item, str):
                # Always run through _split_bullet_text — it handles both
                # multi-line bullet text (splits into multiple items) and
                # plain strings (returns whole string as one item).
                parts = _split_bullet_text(item)
                for p in parts:
                    cleaned = _normalize_achievement_text(p)
                    if cleaned:
                        result.append(cleaned)

            elif isinstance(item, dict):
                # Object with title/description — merge into one string
                title = item.get("title", "").strip() if isinstance(item.get("title"), str) else ""
                description = item.get("description", "").strip() if isinstance(item.get("description"), str) else ""

                if title and description:
                    merged = f"{title} — {description}"
                elif title:
                    merged = title
                elif description:
                    merged = description
                else:
                    continue

                cleaned = _normalize_achievement_text(merged)
                if cleaned:
                    result.append(cleaned)

        return result

    # -- Fallback: unexpected type -------------------------------------------
    return []


def normalize_achievements_as_objects(
    achievements: Any,
) -> List[Dict[str, str]]:
    """Normalize achievements into a list of ``{title, description}`` objects.

    This is a convenience wrapper around :func:`normalize_achievements` that
    maps the resulting strings into the object format expected by the frontend.

    The full string is stored as **title** and ``description`` is left empty,
    since the parsed text already contains the complete achievement narrative.
    """
    strings = normalize_achievements(achievements)
    return [
        {"title": s, "description": ""}
        for s in strings
    ]
