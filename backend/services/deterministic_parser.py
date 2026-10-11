"""Deterministic resume parser — extracted text → structured resume draft.

Responsibility:
  - Turn extracted resume text (PDF or DOCX) into the same schema the AI
    import layer produces (frontend types/resume.ts minus builder fields),
    using rules only: section headings, bullets, date ranges, separators
    and keyword cues.
  - Same input → same output. No network, no model.

The draft is the import baseline: the AI layer reviews and corrects it when
available, and it is used as-is when AI is unavailable. Output still goes
through ats_service.postprocess_resume_data(), like the AI output does.

Design notes:
  - Section headings reuse scoring_service's detector plus a few
    import-only aliases (e.g. "awards", "work history").
  - Never invents content: every value is a substring (modulo whitespace
    and bullet glyphs) of the extracted text.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from services.scoring_service import _heading_key

# ============================================================
# Patterns
# ============================================================

_MONTH = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
    r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?"
)
# Numeric forms need a real month (so "8.7/10" or "3.8/4.0" is never a date)
_NUM_MONTH = r"(?:0?[1-9]|1[0-2])"
_DATE_TOKEN = (
    rf"(?:{_MONTH}\s*,?\s*'?\d{{2,4}}|{_NUM_MONTH}/(?:19|20)?\d{{2}}"
    rf"|(?:19|20)\d{{2}}[-/]{_NUM_MONTH}|(?:19|20)\d{{2}})"
)
_PRESENT = r"(?:present|current|now|ongoing|till\s+date|to\s+date)"
_RANGE_RE = re.compile(
    rf"(?<![\w./])({_DATE_TOKEN})\s*(?:-|–|—|~|to|until)\s*({_DATE_TOKEN}|{_PRESENT})(?![\w/.]\d)(?!\w)", re.I
)
_SINGLE_DATE_RE = re.compile(
    rf"(?<![\w./])(?:(?:expected|graduat(?:ed|ing)|issued|completed)\s*:?\s*)?({_DATE_TOKEN})(?![\w/.]\d)(?!\w)", re.I
)
_PRESENT_RE = re.compile(rf"^{_PRESENT}$", re.I)

_BULLET_RE = re.compile(r"^\s*[•●▪◦*\-–—›»·♦→✓✔✦✧▸▹►▫○□■▶▷◆◇]\s*")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE_RE = re.compile(r"(?<![\w(])(\+?\(?\d[\d\s().-]{7,}\d)(?![\w])")
# DOCX extraction renders hyperlinks as [label](url)
_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)\s]+)\)")
_URL_RE = re.compile(
    r"(?<![@\w.])((?:https?://)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:/[^\s|,;)]*)?)",
    re.I,
)
_TLDS = {
    "com", "org", "net", "io", "dev", "me", "ai", "app", "co", "in", "edu", "info", "xyz",
    "tech", "site", "page", "us", "uk", "ca", "de", "so", "sh", "gg", "cc", "codes",
    "design", "studio", "online", "blog", "art", "digital", "works", "cloud", "space",
    "website", "portfolio", "software", "solutions", "eu", "au", "fr", "nl",
}
_PART_SEP_RE = re.compile(r"\s+[|•·◦]\s+|\s*\|\s*|\s+[—–]\s+|\s+-\s+|\t+|\s{3,}")
_LOCATION_RE = re.compile(
    r"^(?:remote|hybrid|on-?site|"
    r"[A-Z][A-Za-z.'\- ]{1,30},\s*(?:[A-Z]{2}|[A-Z][A-Za-z.'\- ]{2,30})(?:,\s*[A-Z][A-Za-z.'\- ]{2,30})?)"
    r"(?:\s*\((?:remote|hybrid|on-?site)\))?$",
    re.I,
)
_GRADE_RE = re.compile(
    r"((?:c?gpa|grade|percentage|score)\s*[:\-]?\s*\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?"
    r"|\d+(?:\.\d+)?\s*/\s*(?:4|5|10)(?:\.0+)?\s*(?:c?gpa)?|\d{2}(?:\.\d+)?\s*%)",
    re.I,
)
_DOI_RE = re.compile(r"\b(10\.\d{4,9}/[^\s,;]+)", re.I)
_TECH_LINE_RE = re.compile(r"^(?:tech(?:nologies|nology| stack)?|stack|built with|tools(?: used)?)\s*:\s*(.+)$", re.I)

_ROLE_WORDS = re.compile(
    r"\b(?:engineer|developer|programmer|manager|intern(?:ship)?|analyst|designer|scientist|lead|"
    r"consultant|director|specialist|associate|assistant|officer|architect|administrator|"
    r"coordinator|head|founder|co-founder|researcher|fellow|teaching|tutor|instructor|"
    r"president|vice|executive|representative|technician|editor|writer|volunteer|member|"
    r"trainee|apprentice|sde|swe|cto|ceo|vp|owner|strategist|marketer|accountant|recruiter)\b",
    re.I,
)
_DEGREE_RE = re.compile(
    r"^((?:bachelor|master|doctor)(?:'s)?(?:\s+of\s+(?!in\b)[A-Z][A-Za-z]+(?:\s+(?!in\b)[A-Z][A-Za-z]+)?)?"
    r"|ph\.?\s?d\.?|mba|m\.?b\.?a\.?|associate(?:'s)?(?:\s+of\s+\w+)?|diploma|high school(?: diploma)?"
    r"|(?:b|m)\.?\s?(?:tech|sc|com|e|s|a|eng|des|arch|ed|phil|ca)\.?(?![a-z])"
    r"|(?:b|m)\.(?:s|a)\.|bs|ba|ms|ma|be|me|btech|mtech|bsc|msc|bca|mca|bba)(?![a-z])",
    re.I,
)
_INSTITUTION_RE = re.compile(
    r"\b(?:university|college|institute|school|academy|polytechnic|iit|nit|iiit|bits|universit[àéy]|"
    r"conservatory|seminary)\b",
    re.I,
)

# Import-only heading aliases (scoring keeps its own, smaller list)
_EXTRA_HEADINGS = {
    "experience": {"work history", "employment history", "internships", "internship", "work", "professional background", "relevant experience"},
    "projects": {"key projects", "selected projects", "side projects", "project experience", "project"},
    "skills": {"technical skills", "skills and tools", "skills & tools", "tools", "technologies", "key skills", "skill set", "skillset"},
    "achievements": {"awards", "honors", "honours", "honors and awards", "honors awards", "awards and honors", "awards achievements", "achievements and awards", "accomplishments"},
    "certifications": {"licenses and certifications", "licenses certifications", "certification", "courses and certifications", "certifications and courses"},
    "summary": {"about", "about me", "objective", "career objective", "professional profile", "personal statement"},
    "education": {"academics", "academic qualifications", "qualifications", "educational background"},
    "research": {"research experience", "research projects"},
    "publications": {"papers", "selected publications"},
    "languages": {"spoken languages", "language proficiency"},
}


# ============================================================
# Small helpers
# ============================================================


def _clean(line: str) -> str:
    """Normalise whitespace, keeping wide column gaps as a tab separator."""
    line = line.replace(" ", " ").replace("�", "")
    line = re.sub(r"	+| {3,}", "	", line.strip())
    return re.sub(r" {2}", " ", line).strip()


def _heading(line: str) -> Optional[str]:
    if len(line) > 50:
        return None
    key = _heading_key(line)
    if key:
        return key
    clean = re.sub(r"[^a-z ]", "", line.lower().replace("&", " and ")).strip()
    clean = re.sub(r"\s+", " ", clean)
    for name, aliases in _EXTRA_HEADINGS.items():
        if clean in aliases:
            return name
    return None


def _is_bullet(line: str) -> bool:
    return bool(_BULLET_RE.match(line)) and len(_BULLET_RE.sub("", line)) > 0


def _strip_bullet(line: str) -> str:
    return _BULLET_RE.sub("", line).strip()


def _split_parts(text: str) -> List[str]:
    return [p.strip(" ,") for p in _PART_SEP_RE.split(text) if p and p.strip(" ,")]


def _split_list(text: str) -> List[str]:
    """Split a comma/semicolon list, keeping commas inside parentheses."""
    items: List[str] = []
    depth = 0
    current = ""
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if depth == 0 and ch in ",;|•·":
            items.append(current)
            current = ""
        else:
            current += ch
    items.append(current)
    return [i.strip(" .") for i in items if i.strip(" .")]


def _extract_range(text: str) -> Tuple[str, str, str]:
    """Return (start, end, text_without_dates). end may be 'Present'."""
    m = _RANGE_RE.search(text)
    if m:
        start, end = m.group(1), m.group(2)
        if _PRESENT_RE.match(end.strip()):
            end = "Present"
        rest = (text[: m.start()] + " " + text[m.end():]).strip()
        return start.strip(), end.strip(), _tidy(rest)
    m = _SINGLE_DATE_RE.search(text)
    if m:
        rest = (text[: m.start()] + " " + text[m.end():]).strip()
        return "", m.group(1).strip(), _tidy(rest)
    return "", "", text


def _tidy(text: str) -> str:
    """Remove separators left dangling after cutting a date out of a line."""
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"^(?:\s*[|•·,\-–—:]\s*)+|(?:\s*[|•·,\-–—:]\s*)+$", "", text)
    return text.strip()


def _has_date(text: str) -> bool:
    return bool(_RANGE_RE.search(text) or _SINGLE_DATE_RE.search(text))


def _looks_like_url(token: str) -> bool:
    token = token.strip().rstrip("/.")
    if "@" in token or " " in token:
        return False
    m = _URL_RE.fullmatch(token)
    if not m:
        return False
    host = re.sub(r"^https?://", "", token, flags=re.I).split("/")[0]
    tld = host.rsplit(".", 1)[-1].lower()
    return tld in _TLDS or token.lower().startswith(("http://", "https://", "www."))


def _unwrap_md_links(text: str) -> Tuple[str, List[str]]:
    """Replace DOCX "[label](url)" with the label; return the URLs found."""
    urls: List[str] = []

    def repl(m: re.Match) -> str:
        label, url = m.group(1).strip(), m.group(2).strip()
        if not url.lower().startswith(("mailto:", "tel:")):
            urls.append(url)
        if url.lower().startswith("mailto:") and not label:
            return url[7:]
        return label or url

    return _MD_LINK_RE.sub(repl, text), urls


def _find_urls(text: str) -> List[str]:
    found = []
    for m in _URL_RE.finditer(text):
        token = m.group(1).rstrip(".,)")
        start = m.start(1)
        if start > 0 and text[start - 1] == "@":
            continue
        if _looks_like_url(token):
            found.append(token)
    return found


# ============================================================
# Sectioning
# ============================================================


def _split_sections(lines: List[str]) -> Tuple[List[str], Dict[str, List[str]]]:
    header: List[str] = []
    sections: Dict[str, List[str]] = {}
    current: Optional[str] = None
    for line in lines:
        key = _heading(line)
        if key:
            current = key
            sections.setdefault(key, [])
            continue
        if current is None:
            header.append(line)
        else:
            sections[current].append(line)
    return header, sections


def _group_entries(lines: List[str]) -> List[Tuple[List[str], List[str]]]:
    """Group section lines into (header_lines, bullet_lines) entries.

    A run of non-bullet lines heads an entry; bullets attach to it. A
    non-bullet line after bullets is either a wrapped bullet continuation
    or the next entry's header — decided by dates, punctuation and case.
    """
    entries: List[Tuple[List[str], List[str]]] = []
    header: List[str] = []
    body: List[str] = []

    def flush():
        if header or body:
            entries.append((list(header), list(body)))

    for i, line in enumerate(lines):
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if _is_bullet(line):
            body.append(_strip_bullet(line))
            continue

        if body:
            prev = body[-1]
            starts_lower = line[:1].islower()
            ends_sentence = prev.rstrip().endswith((".", "!", "?", ";"))
            is_header = (
                not starts_lower
                and (
                    _has_date(line)
                    or (nxt and not _is_bullet(nxt) and _has_date(nxt) and len(nxt) < 60)
                    or ends_sentence
                    or bool(_PART_SEP_RE.search(line))
                )
            )
            if is_header:
                flush()
                header, body = [line], []
            else:
                body[-1] = f"{prev} {line}".strip()
            continue

        # Long non-bullet lines under a dated header are paragraph content
        if header and len(header) >= 2 and len(line) > 90:
            body.append(line)
            continue
        header.append(line)

    flush()
    return entries


# ============================================================
# Section parsers
# ============================================================


def _parse_profile(header_lines: List[str], all_urls: List[str]) -> Dict[str, Any]:
    profile: Dict[str, Any] = {
        "fullName": "", "title": "", "email": "", "phone": "", "location": "", "links": [],
    }
    title_parts: List[str] = []
    links: List[str] = []

    for idx, line in enumerate(header_lines):
        parts = _split_parts(line) or [line]
        contact_line = False
        for part in parts:
            email = _EMAIL_RE.search(part)
            if email:
                if not profile["email"]:
                    profile["email"] = email.group(0)
                contact_line = True
                continue
            phone = _PHONE_RE.search(part)
            if phone and len(re.sub(r"\D", "", phone.group(1))) >= 7 and not _has_date(part):
                if not profile["phone"]:
                    profile["phone"] = phone.group(1).strip()
                contact_line = True
                continue
            if _looks_like_url(part):
                links.append(part)
                contact_line = True
                continue
            if _LOCATION_RE.match(part):
                if not profile["location"]:
                    profile["location"] = part
                contact_line = True
                continue
            if not profile["fullName"] and not re.search(r"\d", part) and len(part.split()) <= 5:
                profile["fullName"] = part.title() if part.isupper() else part
                continue
            if not contact_line and profile["fullName"] and idx <= 3:
                title_parts.append(part)

    profile["title"] = " | ".join(title_parts)
    seen = set()
    for url in links + all_urls:
        key = url.lower().rstrip("/")
        if key not in seen:
            seen.add(key)
            profile["links"].append({"label": "", "url": url, "username": ""})
    return profile


def _parse_experience_header(header: List[str]) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "company": "", "role": "", "location": "", "startDate": "", "endDate": "",
        "currentlyWorking": False, "bullets": [],
    }
    pieces: List[str] = []
    for line in header:
        start, end, rest = _extract_range(line)
        if (start or end) and not entry["endDate"] and not entry["startDate"]:
            entry["startDate"], entry["endDate"] = start, end
            line = rest
        pieces.extend(_split_parts(line))

    leftovers: List[str] = []
    for piece in pieces:
        if not entry["location"] and _LOCATION_RE.match(piece):
            entry["location"] = piece
            continue
        # "Google, Mountain View, CA" → company + location
        m = re.match(r"^(.+?),\s*(.+)$", piece)
        if m and not entry["location"] and _LOCATION_RE.match(m.group(2)):
            entry["location"] = m.group(2)
            piece = m.group(1)
        if not entry["role"] and _ROLE_WORDS.search(piece):
            entry["role"] = piece
        else:
            leftovers.append(piece)

    for piece in leftovers:
        if not entry["company"]:
            entry["company"] = piece
        elif not entry["role"]:
            entry["role"] = piece

    # "Amazon, Bangalore" reads as a location; with no company, its first
    # part is the company.
    if not entry["company"] and entry["location"]:
        head, sep, tail = entry["location"].partition(",")
        if sep and tail.strip() and not re.match(r"^(?:remote|hybrid|on-?site)$", head.strip(), re.I):
            entry["company"], entry["location"] = head.strip(), tail.strip()

    if entry["endDate"] == "Present":
        entry["currentlyWorking"] = True
        entry["endDate"] = ""
    return entry


def _parse_experience(lines: List[str]) -> List[Dict[str, Any]]:
    out = []
    for header, body in _group_entries(lines):
        entry = _parse_experience_header(header[:3])
        entry["bullets"] = header[3:] + body
        if entry["company"] or entry["role"] or entry["bullets"]:
            out.append(entry)
    return out


def _parse_education(lines: List[str]) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    def new_entry() -> Dict[str, Any]:
        return {"institution": "", "degree": "", "field": "", "grade": "", "startDate": "", "endDate": ""}

    for raw in lines:
        line = _strip_bullet(raw)
        # Grade first: "CGPA: 8.7/10" must not be read as a date
        grade_match = _GRADE_RE.search(line)
        grade = grade_match.group(1).strip() if grade_match else ""
        if grade_match:
            line = _tidy(line[: grade_match.start()] + "	" + line[grade_match.end():])
        start, end, line = _extract_range(line)

        institution, degree, field, other = "", "", "", []
        for piece in _split_parts(line):
            if not institution and _INSTITUTION_RE.search(piece) and not _DEGREE_RE.match(piece):
                institution = piece
                continue
            dm = _DEGREE_RE.match(piece)
            if not degree and dm:
                degree = dm.group(1).strip()
                remainder = piece[dm.end():].strip()
                remainder = re.sub(r"^(?:in|of|,|-|–|—|:)\s*", "", remainder, flags=re.I)
                if remainder:
                    # "Bachelor of Science in Computer Science"
                    split = re.split(r"\s+in\s+", remainder, maxsplit=1, flags=re.I)
                    if len(split) == 2 and degree.lower().startswith(("bachelor", "master", "doctor")):
                        degree = f"{degree} {split[0]}".strip()
                        remainder = split[1]
                    field = remainder.strip(" ,")
                continue
            if not _LOCATION_RE.match(piece):
                other.append(piece)

        starts_new = current is None or (
            (institution and current["institution"])
            or (degree and current["degree"])
            or ((start or end) and current["endDate"] and not (institution or degree))
        )
        if starts_new and (institution or degree or start or end or grade):
            current = new_entry()
            entries.append(current)
        if current is None:
            continue
        current["institution"] = current["institution"] or institution
        current["degree"] = current["degree"] or degree
        current["field"] = current["field"] or field
        current["grade"] = current["grade"] or grade
        if (start or end) and not current["endDate"]:
            current["startDate"], current["endDate"] = start, end
        if other and not current["institution"] and not institution and not degree:
            current["institution"] = other[0]
        elif other and current["institution"] and not current["degree"] and not degree:
            current["degree"] = other[0]  # e.g. "Class XII (CBSE)"
        elif other and current["degree"] and not current["field"] and len(other[0].split()) <= 6:
            current["field"] = other[0]

    for e in entries:
        if e["endDate"] == "Present":
            e["endDate"] = ""
    return [e for e in entries if e["institution"] or e["degree"]]


def _parse_skills(lines: List[str]) -> List[Dict[str, Any]]:
    categories: List[Dict[str, Any]] = []
    general: Optional[Dict[str, Any]] = None
    for raw in lines:
        line = _strip_bullet(raw)
        m = re.match(r"^([^:]{1,40}):\s*(.*)$", line)
        if m:
            categories.append({"title": m.group(1).strip(), "items": _split_list(m.group(2))})
            continue
        items = _split_list(line)
        if categories and categories[-1] is not general and len(lines) > 1 and not _is_bullet(raw):
            categories[-1]["items"].extend(items)  # wrapped category line
            continue
        if general is None:
            general = {"title": "Skills", "items": []}
            categories.append(general)
        general["items"].extend(items)
    return [c for c in categories if c["items"]]


def _parse_projects(lines: List[str], embedded_urls: List[str]) -> List[Dict[str, Any]]:
    projects = []
    for header, body in _group_entries(lines):
        if not header and body:
            header, body = [body[0]], body[1:]
        project: Dict[str, Any] = {"title": "", "link": "", "technologies": [], "bullets": []}
        title_line = header[0] if header else ""
        _, _, title_line = _extract_range(title_line)

        extra_headers = header[1:]
        for text in [title_line] + extra_headers:
            for url in _find_urls(text):
                if not project["link"]:
                    project["link"] = url
        if project["link"]:
            title_line = _tidy(title_line.replace(project["link"], ""))

        bullets: List[str] = []
        for text in extra_headers + body:
            tm = _TECH_LINE_RE.match(text)
            if tm:
                project["technologies"].extend(_split_list(tm.group(1)))
                continue
            _, _, cleaned = _extract_range(text) if text in extra_headers else ("", "", text)
            if not cleaned or (project["link"] and cleaned.strip() == project["link"]):
                continue
            items = _split_list(cleaned)
            if text in extra_headers and len(items) >= 2 and all(len(i.split()) <= 3 for i in items):
                project["technologies"].extend(items)
            else:
                bullets.append(cleaned)

        # "Title (React, Node.js)" or "Title — React, Node.js"
        paren = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", title_line)
        if paren and "," in paren.group(2):
            title_line = paren.group(1)
            project["technologies"].extend(_split_list(paren.group(2)))
        project["title"] = title_line.strip()
        project["bullets"] = bullets

        if not project["link"]:
            # Title before any "| tech" suffix (split off later in post-processing)
            name = re.split(r"\s*[|•(—–]\s*", project["title"])[0]
            slug = re.sub(r"[^a-z0-9]", "", name.lower())
            for url in embedded_urls:
                if slug and len(slug) >= 4 and slug in re.sub(r"[^a-z0-9]", "", url.lower()):
                    project["link"] = url
                    break
        if project["title"] or project["bullets"]:
            projects.append(project)
    return projects


def _parse_certifications(lines: List[str]) -> List[Dict[str, Any]]:
    certs = []
    for raw in lines:
        line = _strip_bullet(raw)
        if not line:
            continue
        _, date, rest = _extract_range(line)
        credential = ""
        cm = re.search(r"(?:credential|license|cert(?:ificate)?)\s*(?:id|no\.?|number)?\s*[:#]\s*(\S+)", rest, re.I)
        if cm:
            credential = cm.group(1)
            rest = _tidy(rest[: cm.start()] + rest[cm.end():])
        by = re.split(r"\s+(?:by|from)\s+", rest, maxsplit=1, flags=re.I)
        parts = by if len(by) == 2 else _split_parts(rest)
        certs.append({
            "title": parts[0] if parts else rest,
            "issuer": parts[1] if len(parts) > 1 else "",
            "date": date,
            "credentialId": credential,
        })
    return [c for c in certs if c["title"]]


def _parse_languages(lines: List[str]) -> List[Dict[str, Any]]:
    langs = []
    for raw in lines:
        for item in _split_list(_strip_bullet(raw)):
            m = re.match(r"^([A-Za-z][A-Za-z ]*?)\s*(?:\(([^)]+)\)|[:\-–—]\s*(.+))?$", item)
            if m:
                langs.append({"name": m.group(1).strip(), "proficiency": (m.group(2) or m.group(3) or "").strip()})
    return langs


def _parse_research(lines: List[str]) -> List[Dict[str, Any]]:
    out = []
    for header, body in _group_entries(lines):
        exp = _parse_experience_header(header[:3])
        end = "Present" if exp["currentlyWorking"] else exp["endDate"]
        duration = f"{exp['startDate']} - {end}" if exp["startDate"] else end
        out.append({
            "title": exp["role"] or exp["company"],
            "institution": exp["company"] if exp["role"] else "",
            "advisor": "",
            "duration": duration,
            "link": "",
            "keywords": [],
            "bullets": header[3:] + body,
        })
    return [r for r in out if r["title"] or r["bullets"]]


def _parse_publications(lines: List[str]) -> List[Dict[str, Any]]:
    pubs = []
    for header, body in _group_entries(lines):
        texts = header + body
        if not texts:
            continue
        first = texts[0]
        _, date, title = _extract_range(first)
        doi = next((m.group(1) for t in texts for m in [_DOI_RE.search(t)] if m), "")
        pubs.append({
            "title": title.strip(' "'),
            "authors": "",
            "venue": texts[1] if len(texts) > 1 and not _DOI_RE.search(texts[1]) else "",
            "date": date,
            "doi": doi,
            "keywords": [],
            "description": " ".join(texts[2:]) if len(texts) > 2 else "",
        })
    return [p for p in pubs if p["title"]]


# ============================================================
# Entry point
# ============================================================


def parse_resume_deterministic(
    text: str, embedded_links: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Parse extracted resume text into the import schema (before post-processing)."""
    raw_lines = [_clean(l) for l in text.replace("\r", "").split("\n")]
    md_urls: List[str] = []
    lines: List[str] = []
    for line in raw_lines:
        if not line:
            continue
        line, urls = _unwrap_md_links(line)
        md_urls.extend(urls)
        lines.append(line)

    header, sections = _split_sections(lines)

    embedded = [
        str(link.get("url", "")).strip()
        for link in (embedded_links or [])
        if isinstance(link, dict) and link.get("url")
    ]
    embedded = [u for u in embedded + md_urls if not u.lower().startswith(("mailto:", "tel:"))]

    result: Dict[str, Any] = {"profile": _parse_profile(header, [])}

    # Embedded/markdown links: profile-level ones (platform profiles,
    # personal sites) go in profile.links; project ones are matched below.
    from services.ats_service import _detect_platform  # local import avoids a cycle
    from services.validator import is_likely_personal_website

    project_urls: List[str] = []
    for url in embedded:
        platform = _detect_platform(url)
        is_repo = bool(re.search(r"github\.com/[^/\s]+/[^/\s]+", url, re.I))
        if (platform and not is_repo) or (not platform and is_likely_personal_website(url)):
            if not any(l["url"].lower().rstrip("/") == url.lower().rstrip("/") for l in result["profile"]["links"]):
                result["profile"]["links"].append({"label": "", "url": url, "username": ""})
        else:
            project_urls.append(url)

    if "summary" in sections:
        result["summary"] = {"text": " ".join(_strip_bullet(l) for l in sections["summary"])}
    if "experience" in sections:
        result["experience"] = _parse_experience(sections["experience"])
    if "projects" in sections:
        result["projects"] = _parse_projects(sections["projects"], project_urls)
    if "education" in sections:
        result["education"] = _parse_education(sections["education"])
    if "skills" in sections:
        result["skills"] = _parse_skills(sections["skills"])
    if "certifications" in sections:
        result["certifications"] = _parse_certifications(sections["certifications"])
    if "achievements" in sections:
        result["achievements"] = [_strip_bullet(l) for l in _merge_wrapped(sections["achievements"])]
    if "languages" in sections:
        result["languages"] = _parse_languages(sections["languages"])
    if "research" in sections:
        result["research"] = _parse_research(sections["research"])
    if "publications" in sections:
        result["publications"] = _parse_publications(sections["publications"])
    return result


def _merge_wrapped(lines: List[str]) -> List[str]:
    """Join continuation lines onto the bullet they wrap from."""
    out: List[str] = []
    for line in lines:
        if out and not _is_bullet(line) and (line[:1].islower() or not out[-1].rstrip().endswith((".", "!", "?"))) and _is_bullet(out[-1]):
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
    return out

