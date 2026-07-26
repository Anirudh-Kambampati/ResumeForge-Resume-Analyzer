"""Certification Normalization — removes duplicated issuer names from titles.

During PDF import the LLM sometimes concatenates the issuer into the title
more than once, producing entries such as:

  title:  "Google AI Essentials — Google & Coursera — Google & Coursera"
  issuer: "Google & Coursera"

The duplicated " — Google & Coursera" suffix is stripped here.
Only the cert name and a single issuer reference (if meaningful) survive.
"""

import re
from typing import Any, Dict, List

# Delimiters that commonly separate certification name from issuer in raw titles
_CERT_SEP_RE = re.compile(r"\s*(?:[–\-—|]|•)\s*")


def _clean_cert_title(title: str, issuer: str) -> str:
    """Remove issuer references from the certification title.

    The issuer is already stored in the separate ``issuer`` field.
    Any segment of the title that exactly matches the issuer (after
    splitting on common separators) is removed from the title to
    avoid duplication.

    Only FULL segments are removed, not substrings, so a certification
    like "Google Project Management" with issuer "Google" is not
    affected — "Google Project Management" is a single segment, not a
    separate "Google" token.

    Strategy:
      1. Split the title on common separators (—, -, |, •).
      2. Remove any segment whose lowercased form matches the lowercased issuer.
      3. Rejoin remaining segments with " — ".

    Args:
        title:  Raw certification title from the LLM (may contain issuer).
        issuer: Separately extracted issuing organization.

    Returns:
        Clean certification name with issuer references removed.
    """
    text = title.strip()
    issuer_clean = issuer.strip()
    if not text or not issuer_clean:
        return title

    segments = _CERT_SEP_RE.split(text)
    if len(segments) <= 1:
        return title  # no separators — nothing remove

    issuer_lower = issuer_clean.lower()
    cleaned: list[str] = []

    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        if seg.lower() == issuer_lower:
            continue  # strip this issuer segment
        cleaned.append(seg)

    result = " — ".join(cleaned)
    return result if result else title


def normalize_certification(cert: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a single certification entry."""
    result: Dict[str, Any] = dict(cert)
    title = result.get("title", "")
    issuer = result.get("issuer", "")
    if title and issuer and isinstance(title, str) and isinstance(issuer, str):
        result["title"] = _clean_cert_title(title, issuer)
    return result


def normalize_certifications(
    cert_list: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Normalize every entry in a certifications list."""
    return [normalize_certification(c) for c in cert_list]
