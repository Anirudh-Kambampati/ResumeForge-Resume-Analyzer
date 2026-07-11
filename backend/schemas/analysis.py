from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class SuggestionItem(BaseModel):
    title: str
    description: str
    priority: str = Field(pattern="^(high|medium|low)$")

class ImprovedBullet(BaseModel):
    original: str
    improved: str

class BreakdownItem(BaseModel):
    score: int
    max_score: int
    evidence: Dict[str, Any]

class AnalysisResult(BaseModel):
    analysis_mode: str = Field(pattern="^(general|job_match)$")
    
    # Scores
    scores: Dict[str, Optional[int]]
    score_gap_insight: str
    
    # Breakdowns
    rule_breakdown: Dict[str, BreakdownItem]
    job_match_breakdown: Optional[Dict[str, BreakdownItem]] = None
    
    matched_keywords: List[str]
    missing_keywords: List[str]
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[SuggestionItem]
    improved_bullets: List[ImprovedBullet]
    interview_focus: List[str]

class ImproveRequest(BaseModel):
    type: str = Field(pattern="^(summary|bullet|project_bullet|experience_bullet|achievement)$")
    text: str
    context: Optional[str] = None
