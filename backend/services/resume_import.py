"""Resume import: deterministic parse → AI review → guarded result.

Pipeline:
  1. PARSE   deterministic_parser builds a draft (always succeeds on text)
  2. REVIEW  the existing ATS AI layer re-reads the text with the draft as a
             reference and returns a corrected version
  3. GUARD   the reviewed version is checked against the source text:
             unsupported values are removed, and if the AI dropped or
             invented too much, the draft is used instead
  4. META    `import_meta` tells the frontend which version it got and why

AI is an improvement, never a requirement: when it's unavailable (server
capacity used up and no user key, provider error, invalid output), the
deterministic draft is returned.
"""

import copy
import logging
import re
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from fastapi import HTTPException

from services.ai_access import ai_error_code
from services.ats_service import postprocess_resume_data, run_ats_optimization
from services.deterministic_parser import parse_resume_deterministic
from services.llm_client import LLMClient

logger = logging.getLogger("resumeforge.pipeline.resume_import")

# Reject the AI version when it keeps less than this share of the draft's
# content, or when more than this share of its own content isn't in the text.
_MIN_CONTENT_KEPT = 0.6
_MAX_UNSUPPORTED = 0.3
# A reworded line still counts as supported when this share of its words appear
_WORD_OVERLAP = 0.85

_LIST_SECTIONS = ("experience", "projects", "education", "certifications", "languages", "research", "publications")


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def _words(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", str(text).lower())


class _Evidence:
    """Answers "is this value actually in the resume?"."""

    def __init__(self, source: str) -> None:
        self.flat = _norm(source)
        self.words = set(_words(source))

    def supports(self, value: Any) -> bool:
        flat = _norm(value)
        if not flat or flat in self.flat:
            return True
        words = _words(value)
        return bool(words) and sum(w in self.words for w in words) / len(words) >= _WORD_OVERLAP


def _content_units(data: Dict[str, Any]) -> int:
    """Rough amount of content: bullets, skill items and list entries."""
    units = 0
    for section in ("experience", "projects", "research"):
        for entry in data.get(section) or []:
            if isinstance(entry, dict):
                units += 1 + len(entry.get("bullets") or [])
    for cat in data.get("skills") or []:
        if isinstance(cat, dict):
            units += len(cat.get("items") or [])
    for section in ("education", "certifications", "languages", "publications", "achievements"):
        units += len(data.get(section) or [])
    return units


def guard_reviewed(
    reviewed: Dict[str, Any], draft: Dict[str, Any], source_text: str
) -> Tuple[Optional[Dict[str, Any]], str]:
    """Strip unsupported values from the AI version; None means use the draft."""
    evidence = _Evidence(source_text)
    result = copy.deepcopy(reviewed)
    checked = 0
    unsupported = 0

    def keep(value: Any) -> bool:
        nonlocal checked, unsupported
        if not isinstance(value, str) or not value.strip():
            return True
        checked += 1
        if evidence.supports(value):
            return True
        unsupported += 1
        return False

    # Profile scalars: fall back to the draft's value when unsupported
    profile = result.get("profile") or {}
    draft_profile = draft.get("profile") or {}
    for key in ("fullName", "email", "phone", "location"):
        if not keep(profile.get(key, "")):
            profile[key] = draft_profile.get(key, "")
    profile["titles"] = [t for t in profile.get("titles") or [] if keep(t)]
    # Links: the URL (minus scheme/www, which post-processing may add) must be in the text
    profile["links"] = [
        link for link in profile.get("links") or []
        if isinstance(link, dict)
        and keep(re.sub(r"^(?:https?://)?(?:www\.)?", "", str(link.get("url", "")), flags=re.I).rstrip("/"))
    ]

    summary = result.get("summary")
    if isinstance(summary, dict) and not keep(summary.get("text", "")):
        result["summary"] = draft.get("summary", {"text": ""})

    entry_fields = {
        "experience": ("company", "role", "location"),
        "projects": ("title",),
        "education": ("institution", "degree", "field", "grade"),
        "certifications": ("title", "issuer"),
        "languages": ("name",),
        "research": ("title", "institution"),
        "publications": ("title", "venue"),
    }
    for section, fields in entry_fields.items():
        for entry in result.get(section) or []:
            if not isinstance(entry, dict):
                continue
            for f in fields:
                if not keep(entry.get(f, "")):
                    entry[f] = ""
            if "bullets" in entry:
                entry["bullets"] = [b for b in entry.get("bullets") or [] if keep(b)]
            if "technologies" in entry:
                entry["technologies"] = [t for t in entry.get("technologies") or [] if keep(t)]

    for cat in result.get("skills") or []:
        if isinstance(cat, dict):
            cat["items"] = [i for i in cat.get("items") or [] if keep(i)]
    if isinstance(result.get("achievements"), list):
        result["achievements"] = [
            a for a in result["achievements"]
            if (keep(a) if isinstance(a, str) else keep(a.get("title", "")) if isinstance(a, dict) else True)
        ]

    if checked and unsupported / checked > _MAX_UNSUPPORTED:
        return None, f"AI output had too much content not found in the resume ({unsupported}/{checked})."

    draft_units = _content_units(draft)
    if draft_units and _content_units(result) < _MIN_CONTENT_KEPT * draft_units:
        return None, "AI output dropped too much of the resume."

    # A section the draft found but the AI dropped is content loss: restore it
    for section in (*_LIST_SECTIONS, "skills", "achievements", "summary"):
        if draft.get(section) and not result.get(section):
            result[section] = copy.deepcopy(draft[section])

    return result, f"{unsupported} unsupported value(s) removed" if unsupported else "clean"


def _llm_text(text: str, embedded_links: List[Dict[str, Any]]) -> str:
    """Resume text plus embedded hyperlinks, as the AI layer has always received it."""
    if not embedded_links:
        return text
    unique_urls = list(dict.fromkeys(link["url"] for link in embedded_links if link.get("url")))
    links_block = "\n".join(f"  [Embedded Hyperlink] {url}" for url in unique_urls)
    return (
        text
        + "\n\n--- EMBEDDED DOCUMENT HYPERLINKS (clickable links in the resume) ---\n"
        + f"{links_block}\n"
        + "--- END EMBEDDED HYPERLINKS ---\n\n"
        + "Note: Where the visible text link and an embedded hyperlink disagree, "
        + "the embedded hyperlink is more reliable. Prefer it."
    )


async def import_resume(
    text: str,
    embedded_links: List[Dict[str, Any]],
    get_llm_client: Callable[[], LLMClient],
    review: Callable[..., Awaitable[Dict[str, Any]]] = run_ats_optimization,
) -> Dict[str, Any]:
    """Run the import pipeline. Always returns a resume; AI only improves it."""
    draft = postprocess_resume_data(parse_resume_deterministic(text, embedded_links))
    meta: Dict[str, Any] = {
        "parser": "deterministic",
        "ai_review": "skipped",
        "message": None,
        "error_code": None,
    }

    try:
        llm_client = get_llm_client()
        reviewed = await review(_llm_text(text, embedded_links), llm_client, draft=draft)
    except HTTPException as exc:
        meta["message"] = str(exc.detail)
        meta["error_code"] = ai_error_code(exc)
        logger.warning("[IMPORT] AI review skipped | status=%s | code=%s", exc.status_code, meta["error_code"])
        return {**draft, "import_meta": meta}
    except Exception as exc:  # noqa: BLE001 — AI failure must never fail the import
        meta["message"] = "AI review failed; showing the rule-based import."
        logger.warning("[IMPORT] AI review failed | error=%s", exc)
        return {**draft, "import_meta": meta}

    source = text + " " + " ".join(link.get("url", "") for link in embedded_links)
    guarded, note = guard_reviewed(reviewed, draft, source)
    if guarded is None:
        meta["ai_review"] = "rejected"
        meta["message"] = "The AI review didn't match the resume closely enough, so the rule-based import was kept."
        logger.warning("[IMPORT] AI review rejected | %s", note)
        return {**draft, "import_meta": meta}

    meta["ai_review"] = "applied"
    logger.info("[IMPORT] AI review applied | %s", note)
    return {**guarded, "import_meta": meta}
