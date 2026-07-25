"""Deterministic, section-aware ATS-oriented resume scoring."""
import re
from collections import Counter
from typing import Any, Dict, List

SECTION_ALIASES = {
    "summary": {"professional summary", "summary", "profile"},
    "experience": {"experience", "work experience", "professional experience", "employment"},
    "projects": {"projects", "personal projects", "academic projects"},
    "education": {"education", "academic background"},
    "skills": {"skills", "technical skills", "technical expertise", "core competencies"},
    "achievements": {"achievements", "accomplishments"},
    "certifications": {"certifications", "certificates"},
    "languages": {"languages"},
    "research": {"research"},
    "publications": {"publications"},
}

SKILL_ALIASES = {
    "javascript": ("javascript", "js"), "typescript": ("typescript", "ts"),
    "react": ("react", "react.js"), "nextjs": ("nextjs", "next.js", "next js"),
    "nodejs": ("nodejs", "node.js", "node js"), "fastapi": ("fastapi", "fast api"),
    "postgresql": ("postgresql", "postgres"), "mongodb": ("mongodb", "mongo"),
    "machine learning": ("machine learning", "ml"),
    "large language models": ("large language models", "llm", "llms"),
    "retrieval augmented generation": ("retrieval augmented generation", "rag"),
    "scikit-learn": ("scikit-learn", "sklearn"),
}

BULLET_RE = re.compile(r"^(?:[•●▪◦*\-–—]|â€¢|â—|â–ª|â—¦)\s*(.*)$")
DATE_RE = re.compile(r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,']+\d{2,4}\b|\b\d{4}-\d{1,2}\b|\b\d{1,2}/\d{4}\b|\b(?:19|20)\d{2}\b", re.I)

# Unicode ranges for decorative / emoji detection (compiled once, not per-call)
_EMOJI_AND_DECORATIVE_RANGE: set[int] = (
    set(range(0x1F300, 0x1FB00))
    | set(range(0x2600, 0x27C0))
    | set(range(0x2700, 0x27BF))
)


def normalize_skill(value: str) -> str:
    v = re.sub(r"\s+", " ", value.lower().strip())
    for canonical, aliases in SKILL_ALIASES.items():
        if v in aliases:
            return canonical
    return v


def _heading_key(line: str) -> str | None:
    """Detect a section heading, robust to PDF extraction artifacts.

    Applies multiple matching strategies in order of specificity:
      1. Exact match against "clean" text
      2. Reconstruct multi-word headings from letter-spaced characters
         ("P R O F E S S I O N A L   S U M M A R Y" -> "professional summary")
      3. Strip all spaces for single-word headings affected by
         character-level letter-spacing ("E X P E R I E N C E" -> "experience")
    """
    clean = re.sub(r"[^a-z ]", "", line.lower()).strip()

    # Strategy 1 — match as-is (normal resume text)
    for key, aliases in SECTION_ALIASES.items():
        if clean in aliases:
            return key

    # Strategy 2 — reconstruct multi-word headings from letter-spaced chars
    # Word boundaries in the original PDF are wider than letter-spacing gaps,
    # so pypdf preserves double-space separators between words.
    if "  " in clean:
        words = [w.replace(" ", "") for w in clean.split("  ") if w.strip()]
        if len(words) > 1:
            reconstructed = " ".join(words)
            for key, aliases in SECTION_ALIASES.items():
                if reconstructed in aliases:
                    return key

    # Strategy 3 — strip all spaces for single-word headings with artifacts
    collapsed = clean.replace(" ", "")
    for key, aliases in SECTION_ALIASES.items():
        if collapsed in aliases:
            return key

    return None


def parse_resume(text: str) -> Dict[str, Any]:
    """Split extracted text into a typed evidence object before scoring it."""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.replace("\r", "").split("\n")]
    headings = [(i, _heading_key(line)) for i, line in enumerate(lines) if _heading_key(line)]
    sections: Dict[str, List[str]] = {}
    order: List[str] = []

    for pos, (start, name) in enumerate(headings):
        end = headings[pos + 1][0] if pos + 1 < len(headings) else len(lines)
        if name not in sections:
            sections[name] = [line for line in lines[start + 1:end] if line]
            order.append(name)
        else:
            sections[name].extend(line for line in lines[start + 1:end] if line)

    first_heading = headings[0][0] if headings else len(lines)
    header = [line for line in lines[:first_heading] if line]
    header_set = set(header)
    candidates = [line for line in lines if line and len(line) < 45 and not _heading_key(line) and line not in header_set]
    unrecognized = [line for line in candidates if line.isupper() and len(line.split()) <= 5]

    return {
        "header_region": "\n".join(header),
        "sections": sections,
        "section_order": order,
        "unrecognized_heading_candidates": unrecognized,
        "lines": lines,
        "extraction_metadata": {
            "extracted_character_count": len(text),
            "line_count": len(lines),
        },
    }


def extract_bullets(sections: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """Centralized bullet collector for Experience and Projects only."""
    output: Dict[str, List[str]] = {"experience": [], "projects": []}

    for name in output:
        current: List[str] = []
        bullet_active = False

        for line in sections.get(name, []):
            match = BULLET_RE.match(line)

            if match:
                if current:
                    output[name].append(" ".join(current).strip())
                current = [match.group(1)] if match.group(1) else []
                bullet_active = True

            elif bullet_active:
                # Date detection only ends wrapped bullets. Dates are not scored.
                if DATE_RE.search(line) and len(line.split()) <= 8:
                    if current:
                        output[name].append(" ".join(current).strip())
                    current = []
                    bullet_active = False
                else:
                    current.append(line)

        if current:
            output[name].append(" ".join(current).strip())

        output[name] = [b for b in output[name] if len(b) > 2]

    return output


def _result(score: int, max_score: int, evidence: Dict[str, Any], reason: str) -> Dict[str, Any]:
    return {
        "score": max(0, min(max_score, int(score))),
        "max_score": max_score,
        "evidence": evidence,
        "reason": reason,
    }


def _machine_readability(text: str) -> Dict[str, Any]:
    meaningful = sum(c.isalnum() or c.isspace() or c in ".,;:()/-+@" for c in text)
    replacement = text.count("\ufffd")
    controls = sum(ord(c) < 32 and c not in "\n\t\r" for c in text)
    words = re.findall(r"[A-Za-z]{2,}", text)
    ratio = meaningful / max(1, len(text))
    corruption = (replacement + controls) / max(1, len(text))

    if len(text.strip()) < 40:
        score = 0
    else:
        score = round(20 * min(1, len(text) / 800) * min(1, ratio / .92) * max(0, 1 - corruption * 12) * (1 if len(words) >= 10 else .5))

    ev = {
        "extraction_succeeded": bool(text.strip()),
        "extracted_character_count": len(text),
        "meaningful_character_count": meaningful,
        "replacement_character_count": replacement,
        "replacement_character_ratio": round(replacement / max(1, len(text)), 4),
        "control_character_ratio": round(controls / max(1, len(text)), 4),
        "recognizable_word_count": len(words),
    }

    return _result(
        score,
        20,
        ev,
        "Extracted text is sufficiently clean and word-like for machine parsing."
        if score >= 15
        else "Extracted text has limited or corrupted machine-readable content.",
    )


def _contact_parseability(parsed: Dict[str, Any], raw_text: str = "") -> Dict[str, Any]:
    """Score the contact block's ATS formatting quality.

    Evaluates 5 criteria (max 10 points):
      1. Contact Structure (3 pts) — grouping, ordering, no noise
      2. Formatting Consistency (2 pts) — single separator type throughout
      3. Spacing Quality (2 pts) — clean spacing, no empty fields, no stray chars
      4. Machine Readability (2 pts) — plain text, clean URLs/email/phone
      5. Extraction Quality (1 pt) — no fragmented contact fields from PDF extraction

    This is NOT a completeness metric. A minimal Phone | Email | LinkedIn block
    scores as high as a verbose block if both are formatted identically.

    raw_text is the original un-normalized extracted text, needed for accurate
    spacing checks (parse_resume normalizes whitespace away).
    """
    header = parsed["header_region"]
    header_lines = [line for line in header.split("\n") if line.strip()]
    all_lines = parsed.get("lines", [])

    # --- Helper: detect contact-bearing lines ---
    def _is_contact_line(line: str) -> bool:
        """Return True if the line carries contact-like content."""
        return bool(re.search(
            r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"   # email
            r"|\+?\d[\d \-()]{6,}\d"            # phone
            r"|linkedin\.com[^\s]*"               # LinkedIn URL
            r"|github\.com[^\s]*"                 # GitHub URL
            r"|https?://[^\s|]+"                  # generic URL
            r"|@[\w.+-]+\.[A-Za-z]{2,}",         # email domain fragment
            line, re.I
        ))

    SEP_RE = re.compile(r"[|" + chr(0x2022) + chr(0x00B7) + "/\u2013\u2014]")

    # Identify contact lines from header (they contain separators or contact patterns)
    contact_lines = []
    for line in header_lines:
        if SEP_RE.search(line) or _is_contact_line(line):
            contact_lines.append(line)

    # Fallback: if nothing detected as contact, use lines after first two
    # (Name → Title → Contact is the standard header layout)
    if not contact_lines and len(header_lines) > 2:
        contact_lines = header_lines[2:]
    elif not contact_lines and len(header_lines) == 2:
        # Only name + title, no contact block found
        contact_lines = []

    contact_text = " ".join(contact_lines) if contact_lines else ""

    # ================================================================
    # 1. Contact Structure (3 pts)
    # ================================================================
    struct_pts = 0

    if contact_lines:
        struct_pts += 1  # contact block exists and is grouped

        # No unrelated text mixed into the contact block
        unrelated = sum(
            1 for line in contact_lines
            if not SEP_RE.search(line)
            and not _is_contact_line(line)
            and len(line) > 25
            and not line.isupper()
        )
        if unrelated == 0:
            struct_pts += 1

        # A single contact line is ideal ATS formatting; multiple lines
        # may indicate awkward line-wrapping. Also penalize if there
        # are more than 6 items (excessive density hurts scanability).
        num_items = max(1, len(SEP_RE.findall(contact_text)) + 1)
        if len(contact_lines) <= 2 and num_items <= 6:
            struct_pts += 1

        # Check that contact block appears immediately below name/title
        # in the header (no intervening unrelated lines)
        name_idx = next((i for i, line in enumerate(header_lines)
                         if re.match(r"^[A-Z][A-Za-z .'-]{1,40}$", line.strip()) and i == 0), None)
        contact_start_idx = min((header_lines.index(cl) for cl in contact_lines if cl in header_lines),
                                default=None)
        if contact_start_idx is not None and name_idx is not None:
            gap_lines = contact_start_idx - name_idx - 1  # title occupies one line normally
            if gap_lines <= 2:
                struct_pts = min(3, struct_pts + 1)

    # ================================================================
    # 2. Formatting Consistency (2 pts)
    # ================================================================
    seps = SEP_RE.findall(contact_text)
    unique_seps = set(seps)

    if not seps:
        consist_pts = 2  # no separator → no inconsistency
        sep_used = "none"
    elif len(unique_seps) == 1:
        consist_pts = 2
        sep_used = list(unique_seps)[0]
        # Also penalize duplicate consecutive separators under this rubric
        if re.search(r"[|" + chr(0x2022) + chr(0x00B7) + "]\s*[|" + chr(0x2022) + chr(0x00B7) + "]", contact_text):
            consist_pts = max(0, consist_pts - 1)
            sep_used += " (but duplicate separators detected)"
    else:
        consist_pts = 0
        sep_used = "mixed: " + ", ".join(sorted(unique_seps))

    # ================================================================
    # 3. Spacing Quality (2 pts)
    # ================================================================
    spacing_issues = []
    spacing_penalties = 0

    # Extract raw header from un-normalized text for spacing checks
    # (parse_resume normalizes whitespace, collapsing double spaces)
    raw_header_lines = raw_text.replace("\r", "").split("\n") if raw_text else []
    first_heading_line = len(raw_header_lines)
    # Find where sections start in raw_text (approximate by matching header_region line count)
    raw_header_region = "\n".join(
        l for l in raw_header_lines[:len(header_lines) + 2]
        if l.strip()
    )[:len(header) * 3]  # generous bound

    # Backup: also always check the normalized text
    spacing_check_text = raw_header_region if raw_header_region else contact_text

    # Missing spaces around separators (e.g. "Phone|Email|LinkedIn")
    sep_chars_escaped = "|" + chr(0x2022) + chr(0x00B7)
    no_space_around = bool(re.search(
        r"[^ ][" + sep_chars_escaped + r"][^ ]",
        contact_text
    ))
    if no_space_around and seps:
        spacing_penalties += 1
        spacing_issues.append("missing_spaces_around_separator")

    # Double or triple+ spaces — check raw text to avoid normalization masking
    if re.search(r"  ", spacing_check_text):
        spacing_penalties += 1
        spacing_issues.append("double_spaces")
    if re.search(r"\s{3,}", spacing_check_text):
        spacing_penalties += 1
        spacing_issues.append("extra_whitespace")

    # Leading or trailing separator
    sep_lead_trail_chars = "|" + chr(0x2022) + chr(0x00B7)
    if re.search(r"^\s*[" + sep_lead_trail_chars + r"]|[" + sep_lead_trail_chars + r"]\s*$", contact_text):
        spacing_penalties += 1
        spacing_issues.append("leading_or_trailing_separator")

    # Empty fields (||, •|, |•, ••, etc.) — also duplicate adjacents
    if re.search(r"[" + sep_chars_escaped + r"]\s*[" + sep_chars_escaped + r"]", contact_text):
        spacing_penalties += 1
        spacing_issues.append("empty_fields")

    spacing_pts = max(0, 2 - spacing_penalties)

    # ================================================================
    # 4. Machine Readability (2 pts)
    # ================================================================
    read_pts = 2
    read_issues = []

    # Emoji / decorative Unicode in contact block
    has_emoji = any(ord(c) in _EMOJI_AND_DECORATIVE_RANGE for c in contact_text)
    decorative = sum(
        1 for c in contact_text
        if ord(c) > 127 and not c.isalnum() and c not in (chr(0x2022) + chr(0x00B7) + "/\u2013\u2014|@.")
    )

    if has_emoji or decorative > 2:
        read_pts -= 1
        read_issues.append("non_plain_text_chars")

    # Check email casing (should be lowercase for ATS)
    emails = re.findall(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", contact_text)
    emails_ok = all(e == e.lower() for e in emails) if emails else True
    if not emails_ok:
        read_pts -= 1
        read_issues.append("uppercase_email")

    # Check phone formatting (no bizarre fragments)
    phones = re.findall(r"\+?\d[\d \-()]{6,}\d", contact_text)
    phones_ok = all(not re.search(r"[^\d+\-() ]", p) for p in phones) if phones else True
    if not phones_ok:
        read_pts -= 1
        read_issues.append("fragmented_phone")

    # Check URLs are recognizable (contain valid domain pattern)
    urls = re.findall(r"(?:https?://)?(?:www\.)?[\w-]+\.[\w.]+(?:/[^\s|]*)?", contact_text)
    for url in urls:
        if not re.search(r"\.(com|in|io|dev|me|org|net|edu)/?$", url + "/", re.I):
            read_pts -= 1
            read_issues.append(f"suspicious_url: {url}")
            break

    read_pts = max(0, min(2, read_pts))

    # ================================================================
    # 5. Extraction Quality (1 pt)
    # ================================================================
    extr_pts = 1
    broken_emails = []
    broken_urls = []
    broken_phones = []

    for i, line in enumerate(all_lines):
        # Email split across lines (e.g. "john@" on one line, "gmail.com" on next)
        line_ends_at = re.search(r"[\w.+-]+@\s*$", line)
        if line_ends_at and i + 1 < len(all_lines):
            next_line = all_lines[i + 1]
            if (re.search(r"^[\w.-]+\.[A-Za-z]{2,}", next_line)
                    and not re.search(r"@", next_line)):
                broken_emails.append(f"{line.strip()} | {next_line.strip()}")
                extr_pts -= 0.5
            elif re.search(r"^\s*$", next_line):
                # Email at end of line with empty next line — still suspect
                broken_emails.append(f"{line.strip()} (followed by empty line)")
                extr_pts -= 0.25

        # Phone split across lines (e.g. "+91" on one line, "9876543210" on next)
        # Only flag if the combined text actually forms a phone pattern
        if (re.search(r"\+?\d[\d \-()]{0,4}$", line)
                and len(re.findall(r"\d", line)) >= 1
                and len(re.findall(r"\d", line)) <= 5
                and i + 1 < len(all_lines)):
            next_line = all_lines[i + 1]
            if re.search(r"^\s*\d", next_line):
                combined = line.strip() + " " + next_line.strip()
                # Only flag if combined looks like a phone number
                digits = re.findall(r"\d", combined)
                if 7 <= len(digits) <= 15 and re.search(r"\+?", combined):
                    broken_phones.append(f"{line.strip()} + {next_line.strip()}")
                    extr_pts -= 0.5

        # LinkedIn / GitHub URL split across lines
        if re.search(r"linkedin\.com/in/$", line, re.I):
            broken_urls.append(line.strip())
            extr_pts -= 0.5
        elif re.search(r"linkedin\.com$", line, re.I) and i + 1 < len(all_lines):
            # "linkedin.com" followed by "/in/user" on next line
            next_line = all_lines[i + 1]
            if re.search(r"^/in/", next_line):
                broken_urls.append(f"{line.strip()} + {next_line.strip()}")
                extr_pts -= 0.5
        if re.search(r"github\.com/$", line, re.I):
            broken_urls.append(line.strip())
            extr_pts -= 0.5

    extr_pts = max(0, round(extr_pts))

    # ================================================================
    # Total (use int() truncation to avoid rounding away sub-point penalties)
    # ================================================================
    raw_total = struct_pts + consist_pts + spacing_pts + read_pts + extr_pts
    total = int(raw_total)

    # If no contact block was detected at all, cap score low
    if not contact_lines and total > 4:
        total = 4
        reason = "No contact block detected in the header region."
        evidence = {
            "contact_block_detected": "",
            "lines_in_block": 0,
            "separator_used": "none",
            "structure_score": 0,
            "formatting_consistency_score": consist_pts,
            "spacing_quality_score": spacing_pts,
            "machine_readability_score": read_pts,
            "extraction_quality_score": extr_pts,
            "issues": {
                "spacing": None,
                "readability": None,
                "broken_emails": None,
                "broken_urls": None,
                "broken_phones": None,
            },
        }
        return _result(total, 10, evidence, reason)

    evidence = {
        "contact_block_detected": contact_text,
        "lines_in_block": len(contact_lines),
        "separator_used": sep_used,
        "structure_score": struct_pts,
        "formatting_consistency_score": consist_pts,
        "spacing_quality_score": spacing_pts,
        "machine_readability_score": read_pts,
        "extraction_quality_score": extr_pts,
        "issues": {
            "spacing": spacing_issues if spacing_issues else None,
            "readability": read_issues if read_issues else None,
            "broken_emails": broken_emails if broken_emails else None,
            "broken_urls": broken_urls if broken_urls else None,
            "broken_phones": broken_phones if broken_phones else None,
        },
    }

    # Build a concise reason string
    reason_parts = []
    if struct_pts < 3:
        reason_parts.append(f"structure ({struct_pts}/3)")
    if consist_pts < 2:
        reason_parts.append(f"inconsistent separator ({sep_used})")
    if spacing_pts < 2:
        reason_parts.append(f"spacing ({spacing_pts}/2)")
    if read_pts < 2:
        reason_parts.append(f"readability ({read_pts}/2)")
    if extr_pts < 1:
        reason_parts.append(f"extraction artifacts ({extr_pts}/1)")

    reason = (
        "Contact block is well-formatted and ATS-friendly."
        if total >= 9
        else f"Contact parseability penalized: {"; ".join(reason_parts)}"
        if reason_parts
        else "Contact block has minor formatting concerns."
    )

    return _result(total, 10, evidence, reason)


def _resume_conciseness(parsed: Dict[str, Any], bullets: Dict[str, List[str]]) -> Dict[str, Any]:
    sections = parsed["sections"]
    all_bullets = bullets["experience"] + bullets["projects"]

    long_bullets = [b for b in all_bullets if len(b.split()) > 35]
    very_long_bullets = [b for b in all_bullets if len(b.split()) > 50]
    summary_words = len(" ".join(sections.get("summary", [])).split())

    heavy_paragraphs = [
        line
        for name in ("experience", "projects")
        for line in sections.get(name, [])
        if not BULLET_RE.match(line) and len(line.split()) > 45
    ]

    total_words = len(re.findall(r"\b[A-Za-z0-9][A-Za-z0-9+.#'-]*\b", " ".join(parsed["lines"])))

    penalty = min(4, len(long_bullets))
    penalty += min(2, len(very_long_bullets))
    penalty += 2 if summary_words > 100 else 0
    penalty += min(2, len(heavy_paragraphs))
    penalty += 2 if total_words > 1200 else 1 if total_words > 900 else 0

    score = max(0, 10 - penalty)

    ev = {
        "total_word_count": total_words,
        "total_bullets": len(all_bullets),
        "long_bullet_count": len(long_bullets),
        "very_long_bullet_count": len(very_long_bullets),
        "summary_word_count": summary_words,
        "paragraph_heavy_line_count": len(heavy_paragraphs),
    }

    reason = (
        "Resume content is concise and scan-friendly."
        if score >= 8
        else "Some resume content could be tightened."
        if score >= 5
        else "Resume content is overly verbose and may reduce scanability."
    )

    return _result(score, 10, ev, reason)


def _skills(parsed: Dict[str, Any]) -> Dict[str, Any]:
    lines = parsed["sections"].get("skills", [])
    categories = []
    raw = []

    for line in lines:
        bits = re.split(r"[:,|]", line, maxsplit=1)
        if len(bits) == 2:
            categories.append(bits[0].strip())
            raw.extend(re.split(r"[,;/]", bits[1]))
        else:
            raw.extend(re.split(r"[,;/]", line))

    normalized = [normalize_skill(x.strip()) for x in raw if len(x.strip()) > 1]
    duplicates = len(normalized) - len(set(normalized))
    ratio = duplicates / max(1, len(normalized))
    score = 0 if not lines else round(10 * min(1, len(normalized) / 3) * max(0, 1 - ratio))

    return _result(
        score,
        10,
        {
            "skills_section_found": bool(lines),
            "skill_categories": categories,
            "normalized_skills": sorted(set(normalized)),
            "duplicate_ratio": round(ratio, 3),
            "parse_failures": 0 if normalized else len(lines),
        },
        "Skills text is grouped and tokenized from a recognized Skills section."
        if normalized
        else "No reliably tokenizable skills were found in a recognized Skills section.",
    )


def score_resume(text: str) -> Dict[str, Any]:
    parsed = parse_resume(text)
    sections = parsed["sections"]
    bullets = extract_bullets(sections)
    skills = _skills(parsed)

    populated = [k for k, v in sections.items() if any(v)]
    major = [k for k in populated if k in {"summary", "experience", "projects", "education", "skills"}]

    outside = max(
        0,
        len([x for x in parsed["lines"] if x])
        - sum(len(v) for v in sections.values())
        - len(parsed["header_region"].split("\n")),
    )

    structure = _result(
        round(15 * min(1, len(major) / 4) * max(.5, 1 - outside / max(1, len(parsed["lines"])))),
        15,
        {
            "recognized_sections": parsed["section_order"],
            "populated_sections": populated,
            "unrecognized_heading_candidates": parsed["unrecognized_heading_candidates"],
            "content_outside_sections": outside,
        },
        "Recognizable sections have clear parsed boundaries.",
    )

    required = {"summary", "education", "skills"}
    has_path = bool({"experience", "projects"} & set(populated))
    recognized = len(required & set(populated)) + int(has_path)

    section_score = _result(
        round(recognized / 4 * 10),
        10,
        {
            "recognized_sections": parsed["section_order"],
            "populated_sections": populated,
            "empty_recognized_sections": [k for k, v in sections.items() if not v],
            "unrecognized_heading_candidates": parsed["unrecognized_heading_candidates"],
        },
        "Populated standard sections were recognized; Projects may satisfy the experience pathway.",
    )

    all_bullets = bullets["experience"] + bullets["projects"]
    malformed = sum(1 for b in all_bullets if len(b.split()) < 2)
    dup = len(all_bullets) - len(set(x.lower() for x in all_bullets))

    content = _result(
        10 if all_bullets else (6 if sections.get("experience") or sections.get("projects") else 4),
        10,
        {
            "total_bullets": len(all_bullets),
            "experience_bullets": bullets["experience"],
            "project_bullets": bullets["projects"],
            "fallback_detected_statements": 0,
            "malformed_fragments": malformed,
            "duplicate_structural_items": dup,
        },
        "Experience and project statements are segmented from their section boundaries."
        if all_bullets
        else "Experience/project content has limited explicit bullet segmentation.",
    )

    tokens = [normalize_skill(x) for x in re.findall(r"[A-Za-z][A-Za-z+.#-]{2,}", text)]
    counts = Counter(tokens)
    suspicious = sorted(k for k, v in counts.items() if v >= 12 and v / max(1, len(tokens)) > .05)

    keyword = _result(
        5 - len(suspicious) * 2,
        5,
        {
            "repeated_terms": dict(sorted((k, v) for k, v in counts.items() if v >= 4)),
            "suspicious_terms": suspicious,
            "duplicate_skill_ratio": skills["evidence"]["duplicate_ratio"],
            "keyword_density_evidence": {"token_count": len(tokens)},
        },
        "No disproportionate repeated technical terms were detected."
        if not suspicious
        else "Repeated terms are disproportionately frequent for the extracted length.",
    )

    layout_signals = {
        "fragmented_short_line_ratio": round(sum(1 for x in parsed["lines"] if 0 < len(x) < 2) / max(1, len(parsed["lines"])), 3),
        "repeated_isolated_glyphs": sum(1 for x in parsed["lines"] if len(x) == 1 and not x.isalnum()),
        "severe_column_interleaving_detected": False,
        "excessive_symbol_noise": sum(1 for x in text if not (x.isalnum() or x.isspace() or x in ".,;:()/-+@&")) > len(text) * .08,
    }

    layout = _result(
        10
        - (4 if layout_signals["excessive_symbol_noise"] else 0)
        - (3 if layout_signals["repeated_isolated_glyphs"] > 8 else 0),
        10,
        layout_signals,
        "No severe text-layout extraction risk signals were detected.",
    )

    breakdown = {
        "machine_readability": _machine_readability(text),
        "standard_ats_structure": structure,
        "contact_parseability": _contact_parseability(parsed, raw_text=text),
        "section_recognition": section_score,
        "resume_conciseness": _resume_conciseness(parsed, bullets),
        "layout_safety_signals": layout,
        "skills_extractability": skills,
        "content_structure": content,
        "keyword_hygiene": keyword,
    }

    return {
        "total_score": sum(x["score"] for x in breakdown.values()),
        "breakdown": breakdown,
        "parsed_evidence": parsed,
    }