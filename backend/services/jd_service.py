"""Deterministic Job Match calculation. AI may only supply structured JD requirements."""
import re
from typing import Any, Dict, List
from services.scoring_service import normalize_skill, parse_resume, SKILL_ALIASES

def _unique(items: List[str]) -> List[str]:
    return list(dict.fromkeys(normalize_skill(x) for x in items if x and x.strip()))

def _match(term: str, text: str) -> str | None:
    aliases=SKILL_ALIASES.get(term,(term,))
    for alias in aliases:
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)",text,re.I): return "exact" if alias==term else "canonical_alias"
    return None

def _ratio_score(matches:int,total:int,maximum:int, neutral:bool=False)->int:
    return maximum if neutral else round(maximum*matches/max(1,total))

def calculate_job_match(resume_text: str, jd_requirements: Dict[str, Any], _unused_score: int | None = None) -> Dict[str, Any]:
    parsed=parse_resume(resume_text); all_text=resume_text.lower(); experience=" ".join(parsed['sections'].get('experience',[])).lower(); projects=" ".join(parsed['sections'].get('projects',[])).lower()
    title=normalize_skill(jd_requirements.get('target_title','')); header=parsed['header_region'].lower()
    if title and re.search(rf"(?<!\w){re.escape(title)}(?!\w)",header): title_type="exact"
    elif title and all(t in header for t in title.split()): title_type="normalized_close"
    elif title and any(t in header for t in title.split()): title_type="related"
    else: title_type="none"
    title_score={"exact":15,"normalized_close":12,"related":6,"none":0}[title_type]
    def skill_category(name:str, maximum:int):
        requested=_unique(jd_requirements.get(name,[])); matched=[]; missing=[]; types={}
        for term in requested:
            kind=_match(term,all_text); (matched if kind else missing).append(term)
            if kind: types[term]=kind
        return {"score":_ratio_score(len(matched),len(requested),maximum,not requested),"max_score":maximum,"evidence":{f"{name}":requested,"matched_"+name:matched,"missing_"+name:missing,"match_type_by_skill":types,"neutral_no_evidence":not requested}}
    required=skill_category('required_skills',25); preferred=skill_category('preferred_skills',10)
    terms=_unique(jd_requirements.get('domain_keywords',[])); exact=[]; aliases=[]; missing=[]
    for term in terms:
        kind=_match(term,all_text)
        if kind=='exact': exact.append(term)
        elif kind: aliases.append(term)
        else: missing.append(term)
    terminology={"score":_ratio_score(len(exact)+len(aliases),len(terms),15,not terms),"max_score":15,"evidence":{"exact_matches":exact,"canonical_alias_matches":aliases,"missing_terms":missing,"neutral_no_evidence":not terms}}
    responsibilities=_unique(jd_requirements.get('responsibilities',[])); resp_matches=[]
    for r in responsibilities:
        words=[w for w in re.findall(r"[a-z]{3,}",r) if w not in {'with','and','the','for'}]
        if words and any(re.search(rf"(?<!\w){re.escape(w)}(?!\w)",experience+" "+projects) for w in words): resp_matches.append(r)
    responsibility={"score":_ratio_score(len(resp_matches),len(responsibilities),10,not responsibilities),"max_score":10,"evidence":{"matched_responsibilities":resp_matches,"missing_responsibilities":[x for x in responsibilities if x not in resp_matches],"evidence_locations":{"experience":experience,"projects":projects}}}
    required_terms=required['evidence']['matched_required_skills']; demonstrated=[s for s in required_terms if _match(s,experience) or _match(s,projects)]
    relevance={"score":_ratio_score(len(demonstrated),len(required['evidence']['required_skills']),15,not required['evidence']['required_skills']),"max_score":15,"evidence":{"demonstrated_terms":demonstrated,"project_evidence":[s for s in demonstrated if _match(s,projects)],"experience_evidence":[s for s in demonstrated if _match(s,experience)]}}
    all_terms=_unique(jd_requirements.get('domain_keywords',[])+jd_requirements.get('required_skills',[])); matched=[t for t in all_terms if _match(t,all_text)]; missing_terms=[t for t in all_terms if t not in matched]
    repeats={t:len(re.findall(rf"(?<!\w){re.escape(t)}(?!\w)",all_text)) for t in matched}; stuffing=[t for t,c in repeats.items() if c>10]
    coverage={"score":max(0,_ratio_score(len(matched),len(all_terms),10,not all_terms)-min(3,len(stuffing))),"max_score":10,"evidence":{"total_relevant_terms":len(all_terms),"matched_relevant_terms":matched,"missing_relevant_terms":missing_terms,"coverage_ratio":round(len(matched)/max(1,len(all_terms)),3),"suspicious_repetition":stuffing}}
    breakdown={"job_title_alignment":{"score":title_score,"max_score":15,"evidence":{"target_title":title,"title_match_type":title_type}},"required_skills_match":required,"preferred_skills_match":preferred,"jd_terminology_alignment":terminology,"responsibility_alignment":responsibility,"project_experience_relevance":relevance,"keyword_coverage_hygiene":coverage}
    return {"total_score":sum(v['score'] for v in breakdown.values()),"breakdown":breakdown,"all_matched_keywords":sorted(set(matched+required['evidence']['matched_required_skills']+preferred['evidence']['matched_preferred_skills'])),"all_missing_keywords":sorted(set(missing_terms+required['evidence']['missing_required_skills']+preferred['evidence']['missing_preferred_skills']))}
