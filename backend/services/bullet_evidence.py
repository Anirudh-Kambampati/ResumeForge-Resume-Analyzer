"""Evidence checks for AI-rewritten bullets returned by /api/analyze.

A rewrite is only surfaced when:
  1. its `original` actually appears in the resume text — compared after
     normalizing whitespace, dashes and quotes, because PDF extraction breaks
     wrapped bullets across lines; and
  2. it passes the claim gate against that original bullet alone, so it can't
     borrow numbers or technologies from other parts of the resume.
"""
import re

from services.validator import validate_generated_claims

# Shorter "originals" (e.g. "Python") match too easily to count as evidence.
MIN_ORIGINAL_LENGTH = 15

_BULLET_PREFIX = re.compile(r"^[\s•●▪◦·*\-–—]+")


def normalize_for_match(text: str) -> str:
    """Lowercase, unify dashes/quotes, drop a leading bullet marker, collapse whitespace."""
    text = text.lower()
    text = text.replace("‘", "'").replace("’", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("–", "-").replace("—", "-")
    text = _BULLET_PREFIX.sub("", text)
    return re.sub(r"\s+", " ", text).strip().rstrip(".;, ")


def original_in_resume(original: str, resume_text: str) -> bool:
    """True when the (normalized) original bullet occurs in the resume text."""
    needle = normalize_for_match(original)
    if len(needle) < MIN_ORIGINAL_LENGTH:
        return False
    return needle in normalize_for_match(resume_text)


def is_safe_rewrite(original: str, improved: str, resume_text: str) -> bool:
    """A rewrite is safe when its original is real and it adds no unsupported claims."""
    if not improved.strip() or not original_in_resume(original, resume_text):
        return False
    return validate_generated_claims(original, improved)
