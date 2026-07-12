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

def normalize_skill(value: str) -> str:
    v = re.sub(r"\s+", " ", value.lower().strip())
    for canonical, aliases in SKILL_ALIASES.items():
        if v in aliases:
            return canonical
    return v

def _heading_key(line: str) -> str | None:
    clean = re.sub(r"[^a-z ]", "", line.lower()).strip()
    for key, aliases in SECTION_ALIASES.items():
        if clean in aliases:
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
    candidates = [line for line in lines if line and len(line) < 45 and not _heading_key(line)]
    unrecognized = [line for line in candidates if line.isupper() and len(line.split()) <= 5]
    return {"header_region": "\n".join(header), "sections": sections, "section_order": order,
            "unrecognized_heading_candidates": unrecognized, "lines": lines,
            "extraction_metadata": {"extracted_character_count": len(text), "line_count": len(lines)}}

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
                # A new entry/date line ends a wrapped bullet; ordinary lines wrap it.
                if DATE_RE.search(line) and len(line.split()) <= 8:
                    if current:
                        output[name].append(" ".join(current).strip())
                    current = []; bullet_active = False
                else:
                    current.append(line)
        if current:
            output[name].append(" ".join(current).strip())
        output[name] = [b for b in output[name] if len(b) > 2]
    return output

def _result(score: int, max_score: int, evidence: Dict[str, Any], reason: str) -> Dict[str, Any]:
    return {"score": max(0, min(max_score, int(score))), "max_score": max_score, "evidence": evidence, "reason": reason}

def _machine_readability(text: str) -> Dict[str, Any]:
    meaningful = sum(c.isalnum() or c.isspace() or c in ".,;:()/-+@" for c in text)
    replacement = text.count("\ufffd"); controls = sum(ord(c) < 32 and c not in "\n\t\r" for c in text)
    words = re.findall(r"[A-Za-z]{2,}", text)
    ratio = meaningful / max(1, len(text)); corruption = (replacement + controls) / max(1, len(text))
    if len(text.strip()) < 40: score = 0
    else: score = round(20 * min(1, len(text) / 800) * min(1, ratio / .92) * max(0, 1 - corruption * 12) * (1 if len(words) >= 10 else .5))
    ev = {"extraction_succeeded": bool(text.strip()), "extracted_character_count": len(text), "meaningful_character_count": meaningful, "replacement_character_count": replacement, "replacement_character_ratio": round(replacement/max(1,len(text)),4), "control_character_ratio": round(controls/max(1,len(text)),4), "recognizable_word_count": len(words)}
    return _result(score, 20, ev, "Extracted text is sufficiently clean and word-like for machine parsing." if score >= 15 else "Extracted text has limited or corrupted machine-readable content.")

def _contact(parsed: Dict[str, Any]) -> Dict[str, Any]:
    header = parsed["header_region"]; lower = header.lower()
    email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", header)
    phone = re.search(r"(?:\+?\d[\d ()-]{7,}\d)", header)
    profile_urls = re.findall(r"(?:https?://)?(?:www\.)?(?:linkedin\.com|github\.com|[\w-]+\.(?:dev|io|me|com))(?:/[^\s|]*)?", header, re.I)
    name = next((line for line in header.split("\n") if re.match(r"^[A-Za-z][A-Za-z .'-]{2,40}$", line) and not _heading_key(line)), "")
    location = bool(re.search(r"\b[A-Za-z .'-]+,\s*[A-Z]{2}\b|\b(?:India|USA|United States|Canada|UK|United Kingdom)\b", header, re.I))
    found = sum(bool(x) for x in (name, email, phone, location, profile_urls))
    ev={"name_found": bool(name), "email": email.group(0) if email else None, "phone": phone.group(0) if phone else None, "location_found": location, "professional_profile_urls": profile_urls}
    return _result(round(found/5*10),10,ev,f"{found} of 5 standard contact signals were found in the extracted header region.")

def _date_consistency(text: str) -> Dict[str, Any]:
    dates=DATE_RE.findall(text); styles=[]
    for d in dates:
        styles.append("year_month" if re.match(r"\d{4}-",d) else "numeric_month_year" if "/" in d else "month_name" if re.search(r"[A-Za-z]",d) else "year")
    distinct=sorted(set(styles)); inconsistent=max(0,len(distinct)-1)
    score=10 if len(dates)<=1 else round(10*(1-inconsistent/max(1,len(distinct))))
    return _result(score,10,{"detected_dates": dates,"normalized_date_styles":styles,"dominant_style":Counter(styles).most_common(1)[0][0] if styles else None,"inconsistent_date_count":inconsistent},"Date formatting is internally consistent." if inconsistent==0 else "Multiple repeated date formats were detected.")

def _skills(parsed: Dict[str,Any]) -> Dict[str,Any]:
    lines=parsed["sections"].get("skills",[]); categories=[]; raw=[]
    for line in lines:
        bits=re.split(r"[:,|]",line, maxsplit=1)
        if len(bits)==2: categories.append(bits[0].strip()); raw.extend(re.split(r"[,;/]",bits[1]))
        else: raw.extend(re.split(r"[,;/]",line))
    normalized=[normalize_skill(x.strip()) for x in raw if len(x.strip())>1]
    duplicates=len(normalized)-len(set(normalized)); ratio=duplicates/max(1,len(normalized))
    score=0 if not lines else round(10*min(1,len(normalized)/3)*max(0,1-ratio))
    return _result(score,10,{"skills_section_found":bool(lines),"skill_categories":categories,"normalized_skills":sorted(set(normalized)),"duplicate_ratio":round(ratio,3),"parse_failures":0 if normalized else len(lines)},"Skills text is grouped and tokenized from a recognized Skills section." if normalized else "No reliably tokenizable skills were found in a recognized Skills section.")

def score_resume(text: str) -> Dict[str, Any]:
    parsed=parse_resume(text); sections=parsed["sections"]; bullets=extract_bullets(sections); skills=_skills(parsed)
    populated=[k for k,v in sections.items() if any(v)]; major=[k for k in populated if k in {"summary","experience","projects","education","skills"}]
    outside=max(0,len([x for x in parsed["lines"] if x])-sum(len(v) for v in sections.values())-len(parsed["header_region"].split("\n")))
    structure=_result(round(15*min(1,len(major)/4)*max(.5,1-outside/max(1,len(parsed['lines'])))),15,{"recognized_sections":parsed["section_order"],"populated_sections":populated,"unrecognized_heading_candidates":parsed["unrecognized_heading_candidates"],"content_outside_sections":outside},"Recognizable sections have clear parsed boundaries.")
    required={"summary","education","skills"}; has_path=bool({"experience","projects"}&set(populated)); recognized=len(required&set(populated))+int(has_path)
    section_score=_result(round(recognized/4*10),10,{"recognized_sections":parsed["section_order"],"populated_sections":populated,"empty_recognized_sections":[k for k,v in sections.items() if not v],"unrecognized_heading_candidates":parsed["unrecognized_heading_candidates"]},"Populated standard sections were recognized; Projects may satisfy the experience pathway.")
    all_bullets=bullets["experience"]+bullets["projects"]; malformed=sum(1 for b in all_bullets if len(b.split())<2); dup=len(all_bullets)-len(set(x.lower() for x in all_bullets))
    content=_result(10 if all_bullets else (6 if sections.get("experience") or sections.get("projects") else 4),10,{"total_bullets":len(all_bullets),"experience_bullets":bullets["experience"],"project_bullets":bullets["projects"],"fallback_detected_statements":0,"malformed_fragments":malformed,"duplicate_structural_items":dup},"Experience and project statements are segmented from their section boundaries." if all_bullets else "Experience/project content has limited explicit bullet segmentation.")
    tokens=[normalize_skill(x) for x in re.findall(r"[A-Za-z][A-Za-z+.#-]{2,}",text)]; counts=Counter(tokens); suspicious=sorted(k for k,v in counts.items() if v>=12 and v/max(1,len(tokens))>.05); keyword=_result(5-len(suspicious)*2,5,{"repeated_terms":dict(sorted((k,v) for k,v in counts.items() if v>=4)),"suspicious_terms":suspicious,"duplicate_skill_ratio":skills["evidence"]["duplicate_ratio"],"keyword_density_evidence":{"token_count":len(tokens)}},"No disproportionate repeated technical terms were detected." if not suspicious else "Repeated terms are disproportionately frequent for the extracted length.")
    layout_signals={"fragmented_short_line_ratio":round(sum(1 for x in parsed['lines'] if 0<len(x)<2)/max(1,len(parsed['lines'])),3),"repeated_isolated_glyphs":sum(1 for x in parsed['lines'] if len(x)==1 and not x.isalnum()),"severe_column_interleaving_detected":False,"excessive_symbol_noise":sum(1 for x in text if not (x.isalnum() or x.isspace() or x in '.,;:()/-+@&'))>len(text)*.08}
    layout=_result(10-(4 if layout_signals["excessive_symbol_noise"] else 0)-(3 if layout_signals["repeated_isolated_glyphs"]>8 else 0),10,layout_signals,"No severe text-layout extraction risk signals were detected.")
    breakdown={"machine_readability":_machine_readability(text),"standard_ats_structure":structure,"contact_parseability":_contact(parsed),"section_recognition":section_score,"date_consistency":_date_consistency(text),"layout_safety_signals":layout,"skills_extractability":skills,"content_structure":content,"keyword_hygiene":keyword}
    return {"total_score":sum(x["score"] for x in breakdown.values()),"breakdown":breakdown,"parsed_evidence":parsed}
