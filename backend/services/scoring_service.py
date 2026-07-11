import re
from typing import Dict, Any, List

def _score_contact_completeness(text: str) -> Dict[str, Any]:
    # Look for email, phone, location, link
    email_match = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text))
    phone_match = bool(re.search(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text))
    # Simple proxies for location and links
    link_match = bool(re.search(r"(linkedin\.com|github\.com|\.dev|\.io)", text, re.IGNORECASE))
    
    score = 0
    if len(text.strip()) > 0:
        score += 1 # Name / header exists simply by having text, roughly
    if email_match: score += 1
    if phone_match: score += 1
    if link_match: score += 1
    # For location, we'll give 1 point if we found other things and string is long enough
    if len(text) > 100: score += 1
    
    return {
        "score": min(score, 5),
        "max_score": 5,
        "evidence": {
            "email_found": email_match,
            "phone_found": phone_match,
            "link_found": link_match
        }
    }

def _score_standard_structure(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    headings = [
        "summary", "professional summary", "profile", 
        "experience", "work experience", "professional experience", 
        "education", "skills", "technical skills", 
        "projects", "achievements", "certifications", "languages"
    ]
    
    found = []
    for h in headings:
        # Check if heading exists as a standalone-ish word
        if re.search(rf"\b{h}\b", text_lower):
            found.append(h)
            
    score = min(len(found) * 2, 15)
    return {
        "score": score,
        "max_score": 15,
        "evidence": {
            "found_headings": found
        }
    }

def _score_section_completeness(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    has_profile = True
    has_summary = bool(re.search(r"\b(summary|profile)\b", text_lower))
    has_education = bool(re.search(r"\beducation\b", text_lower))
    has_skills = bool(re.search(r"\bskills\b", text_lower))
    has_experience = bool(re.search(r"\b(experience|work)\b", text_lower))
    has_projects = bool(re.search(r"\bprojects\b", text_lower))
    
    score = 0
    if has_profile: score += 2
    if has_summary: score += 2
    if has_education: score += 2
    if has_skills: score += 2
    if has_experience or has_projects: score += 2
    
    return {
        "score": score,
        "max_score": 10,
        "evidence": {
            "has_summary": has_summary,
            "has_education": has_education,
            "has_skills": has_skills,
            "has_experience_or_projects": has_experience or has_projects
        }
    }

def _score_skills_presentation(text: str) -> Dict[str, Any]:
    # Extract lines near 'skills'
    has_skills = bool(re.search(r"\bskills\b", text.lower()))
    score = 0
    if has_skills:
        score += 5
        # Proxy for categorization or many skills
        if text.lower().count(',') > 10:
            score += 5
    return {
        "score": score,
        "max_score": 10,
        "evidence": {
            "has_skills_section": has_skills
        }
    }

def _extract_bullets(text: str) -> List[str]:
    # Match bullet symbols, including common PDF conversion artifacts
    # \u2022 = •, \u25CF = ●, \u25AA = ▪, \u25E6 = ◦, \u2013 = –, \u2014 = —
    bullet_regex = r"^(\*|-|–|—|•|●|▪|◦|\u2022|\u25CF|\u25AA|\u25E6)\s*"
    
    lines = text.split('\n')
    bullets = []
    current_bullet = []
    
    for line in lines:
        stripped_line = line.strip()
        if not stripped_line:
            continue
            
        # Ignore obvious headings, contact info, skill categories
        if len(stripped_line) < 5 and not re.match(bullet_regex, stripped_line):
            continue
            
        if re.search(r"^[A-Z][A-Z\s]+$", stripped_line) and len(stripped_line) < 30:
            # Looks like a heading, break current bullet
            if current_bullet:
                bullets.append(" ".join(current_bullet))
                current_bullet = []
            continue
            
        is_new_bullet = False
        if re.match(bullet_regex, stripped_line):
            is_new_bullet = True
            
        if is_new_bullet:
            if current_bullet:
                bullets.append(" ".join(current_bullet))
            # Start new bullet, stripping the actual bullet character
            content = re.sub(bullet_regex, "", stripped_line).strip()
            current_bullet = [content] if content else []
        elif current_bullet:
            # Continuation of previous bullet
            current_bullet.append(stripped_line)
            
    if current_bullet:
        bullets.append(" ".join(current_bullet))
        
    return bullets

def _score_bullet_quality(bullets: List[str]) -> Dict[str, Any]:
    if not bullets:
        return {"score": 0, "max_score": 15, "evidence": {"total_bullets": 0}}
        
    short_bullets = sum(1 for b in bullets if len(b.split()) < 5)
    long_bullets = sum(1 for b in bullets if len(b.split()) > 30)
    weak_bullets = sum(1 for b in bullets if b.lower().startswith(("worked on", "responsible for", "helped with")))
    
    deduction = (short_bullets * 1) + (long_bullets * 1) + (weak_bullets * 2)
    score = max(0, 15 - deduction)
    
    return {
        "score": score,
        "max_score": 15,
        "evidence": {
            "total_bullets": len(bullets),
            "short_bullets": short_bullets,
            "long_bullets": long_bullets,
            "weak_bullets": weak_bullets
        }
    }

def _score_action_verbs(bullets: List[str]) -> Dict[str, Any]:
    if not bullets:
        return {"score": 0, "max_score": 10, "evidence": {"total_bullets": 0}}
        
    verbs = {
        "built", "developed", "implemented", "designed", "created", 
        "engineered", "optimized", "automated", "integrated", "deployed", 
        "analyzed", "improved", "reduced", "increased", "managed", 
        "led", "collaborated", "configured", "migrated", "tested", 
        "trained", "evaluated", "processed", "architected", "delivered"
    }
    
    action_bullets = 0
    for b in bullets:
        words = b.lower().split()
        if words and words[0] in verbs:
            action_bullets += 1
            
    ratio = action_bullets / len(bullets)
    score = min(int(ratio * 15), 10)
    
    return {
        "score": score,
        "max_score": 10,
        "evidence": {
            "action_verb_bullets": action_bullets,
            "eligible_bullets": len(bullets)
        }
    }

def _score_quantified_impact(bullets: List[str]) -> Dict[str, Any]:
    if not bullets:
        return {"score": 0, "max_score": 15, "evidence": {"total_bullets": 0}}
        
    quantified = 0
    for b in bullets:
        if re.search(r"(\d+%|\$\d+|\b\d+\s*(users|requests|records|datasets|hours|days|latency)\b)", b, re.IGNORECASE):
            quantified += 1
            
    ratio = quantified / len(bullets)
    score = min(int(ratio * 20), 15)
    
    return {
        "score": score,
        "max_score": 15,
        "evidence": {
            "total_bullets": len(bullets),
            "quantified_bullets": quantified,
            "quantified_ratio": round(ratio, 2)
        }
    }

def _score_content_specificity(text: str) -> Dict[str, Any]:
    weak_phrases = ["worked on", "responsible for", "helped with", "participated in", "various tasks", "multiple projects", "hard working", "team player"]
    text_lower = text.lower()
    
    weak_count = 0
    for wp in weak_phrases:
        weak_count += text_lower.count(wp)
        
    score = max(0, 10 - weak_count)
    return {
        "score": score,
        "max_score": 10,
        "evidence": {
            "weak_phrases_count": weak_count
        }
    }

def _score_ats_readability(text: str) -> Dict[str, Any]:
    char_count = len(text)
    score = 0
    if char_count > 500:
        score += 5
    if char_count > 1000:
        score += 5
        
    # Check for unreadable characters
    if text.count('\ufffd') > 5:
        score -= 5
        
    score = max(0, score)
    return {
        "score": score,
        "max_score": 10,
        "evidence": {
            "extracted_character_count": char_count,
            "extraction_success": char_count > 0
        }
    }

def score_resume(text: str) -> Dict[str, Any]:
    bullets = _extract_bullets(text)
    
    contact = _score_contact_completeness(text)
    structure = _score_standard_structure(text)
    section = _score_section_completeness(text)
    skills = _score_skills_presentation(text)
    bullet_qual = _score_bullet_quality(bullets)
    action_verbs = _score_action_verbs(bullets)
    quantified = _score_quantified_impact(bullets)
    specificity = _score_content_specificity(text)
    ats = _score_ats_readability(text)
    
    total_score = (
        contact["score"] + structure["score"] + section["score"] + 
        skills["score"] + bullet_qual["score"] + action_verbs["score"] + 
        quantified["score"] + specificity["score"] + ats["score"]
    )
    
    return {
        "total_score": total_score,
        "breakdown": {
            "contact_completeness": contact,
            "standard_structure": structure,
            "section_completeness": section,
            "skills_presentation": skills,
            "bullet_quality": bullet_qual,
            "action_verbs": action_verbs,
            "quantified_impact": quantified,
            "content_specificity": specificity,
            "ats_readability": ats
        }
    }
