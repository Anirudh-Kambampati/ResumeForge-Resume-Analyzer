import re
from typing import Dict, Any, List

def normalize_skill(skill: str) -> str:
    skill = skill.lower().strip()
    aliases = {
        "js": "javascript",
        "ts": "typescript",
        "fast api": "fastapi",
        "postgres": "postgresql",
        "ml": "machine learning",
        "llm": "large language models",
        "llms": "large language models",
        "rag": "retrieval augmented generation"
    }
    return aliases.get(skill, skill)

def calculate_job_match(resume_text: str, jd_requirements: Dict[str, Any], resume_quality_score: int) -> Dict[str, Any]:
    text_lower = resume_text.lower()
    
    # 1. Required Skills Match (30)
    req_skills = [normalize_skill(s) for s in jd_requirements.get("required_skills", [])]
    req_matched = []
    req_missing = []
    for s in set(req_skills):
        if re.search(rf"\b{re.escape(s)}\b", text_lower):
            req_matched.append(s)
        else:
            req_missing.append(s)
            
    req_score = 0
    if req_skills:
        req_score = int((len(req_matched) / len(set(req_skills))) * 30)
    else:
        req_score = 30 # Default to max if no requirements specified
        
    # 2. Preferred Skills Match (10)
    pref_skills = [normalize_skill(s) for s in jd_requirements.get("preferred_skills", [])]
    pref_matched = []
    pref_missing = []
    for s in set(pref_skills):
        if re.search(rf"\b{re.escape(s)}\b", text_lower):
            pref_matched.append(s)
        else:
            pref_missing.append(s)
            
    pref_score = 0
    if pref_skills:
        pref_score = int((len(pref_matched) / len(set(pref_skills))) * 10)
    else:
        pref_score = 10
        
    # 3. Keyword Alignment (15)
    domain_keywords = [normalize_skill(s) for s in jd_requirements.get("domain_keywords", [])]
    kw_matched = []
    kw_missing = []
    for kw in set(domain_keywords):
        if re.search(rf"\b{re.escape(kw)}\b", text_lower):
            kw_matched.append(kw)
        else:
            kw_missing.append(kw)
            
    kw_score = 0
    if domain_keywords:
        kw_score = int((len(kw_matched) / len(set(domain_keywords))) * 15)
    else:
        kw_score = 15
        
    # 4. Experience Relevance (15)
    # 5. Project Relevance (15)
    # Since we can't easily parse experience vs projects perfectly, we'll use a combined proxy based on responsibilities
    resp_keywords = [normalize_skill(s) for s in jd_requirements.get("responsibilities", [])]
    resp_matched = []
    for r in set(resp_keywords):
        if re.search(rf"\b{re.escape(r)}\b", text_lower):
            resp_matched.append(r)
            
    resp_ratio = len(resp_matched) / len(set(resp_keywords)) if resp_keywords else 1.0
    exp_score = int(resp_ratio * 15)
    proj_score = int(resp_ratio * 15)
    
    # 6. Resume Quality (15)
    qual_score = int((resume_quality_score / 100.0) * 15)
    
    total_score = req_score + pref_score + kw_score + exp_score + proj_score + qual_score
    
    return {
        "total_score": total_score,
        "breakdown": {
            "required_skill_match": {
                "score": req_score,
                "max_score": 30,
                "evidence": {
                    "matched": req_matched,
                    "missing": req_missing
                }
            },
            "preferred_skill_match": {
                "score": pref_score,
                "max_score": 10,
                "evidence": {
                    "matched": pref_matched,
                    "missing": pref_missing
                }
            },
            "keyword_alignment": {
                "score": kw_score,
                "max_score": 15,
                "evidence": {
                    "matched": kw_matched,
                    "missing": kw_missing
                }
            },
            "experience_relevance": {
                "score": exp_score,
                "max_score": 15,
                "evidence": {
                    "matched_responsibilities": resp_matched
                }
            },
            "project_relevance": {
                "score": proj_score,
                "max_score": 15,
                "evidence": {
                    "matched_responsibilities": resp_matched
                }
            },
            "resume_quality": {
                "score": qual_score,
                "max_score": 15,
                "evidence": {
                    "deterministic_rule_score": resume_quality_score
                }
            }
        },
        "all_matched_keywords": req_matched + pref_matched + kw_matched,
        "all_missing_keywords": req_missing + pref_missing + kw_missing
    }
