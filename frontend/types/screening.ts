// ============================================================
// ResumeForge for Businesses — screening types
// Mirrors the /api/business/* responses in backend/main.py.
// ============================================================

export interface JDRequirements {
  target_title: string;
  required_skills: string[];
  preferred_skills: string[];
  domain_keywords: string[];
  responsibilities: string[];
}

export type RequirementListKey = Exclude<keyof JDRequirements, "target_title">;

export interface MatchedMissing {
  matched: string[];
  missing: string[];
}

export interface ScreenCategory {
  key: string;
  label: string;
  score: number;
  max_score: number;
}

export interface ScreenResult {
  candidate: { name: string | null; email: string | null };
  match_score: number;
  ats_score: number;
  categories: ScreenCategory[];
  title_match: "exact" | "normalized_close" | "related" | "none";
  required_skills: MatchedMissing;
  preferred_skills: MatchedMissing;
  responsibilities: MatchedMissing;
  matched_keywords: string[];
  missing_keywords: string[];
  resume_text: string;
}

export interface CandidateBrief {
  summary: string;
  strengths: string[];
  gaps: string[];
  interview_questions: string[];
}

export type CandidateStatus = "queued" | "screening" | "done" | "error";
export type BriefStatus = "idle" | "queued" | "loading" | "done" | "error";
export type SummaryStatus = "idle" | "queued" | "loading" | "done" | "error";

export interface Candidate {
  id: string;
  file: File | null;
  fileName: string;
  size: number;
  status: CandidateStatus;
  result?: ScreenResult;
  error?: string;
  /** One-sentence AI take, auto-generated after the resume is screened */
  summaryStatus: SummaryStatus;
  aiSummary?: string;
  summaryError?: string;
  briefStatus: BriefStatus;
  brief?: CandidateBrief;
  briefError?: string;
}

/** draft: being set up · running: screening its candidates · paused: no new work starts */
export type QueueStatus = "draft" | "running" | "paused";

export interface ScreeningQueue {
  id: string;
  name: string;
  jobDescription: string;
  requirements: JDRequirements | null;
  requirementsStatus: "idle" | "loading" | "error";
  requirementsError?: string;
  /** Requirements were edited after some candidates were scored */
  requirementsDirty: boolean;
  status: QueueStatus;
  candidates: Candidate[];
  createdAt: number;
}
