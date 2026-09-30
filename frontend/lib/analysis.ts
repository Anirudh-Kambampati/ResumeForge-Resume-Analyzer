import type { Resume } from "@/types/resume";
import type { BuilderSection } from "@/store/resumeStore";

// ============================================================
// Resume analysis — response types + applying rewritten bullets
//
// /api/analyze returns improved bullets as { original, improved }
// text pairs (no IDs), so the builder locates each original by
// normalized text. Locations are keyed by entry id (not index) so
// they survive card reordering.
// ============================================================

export interface AnalysisSuggestion {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface ImprovedBullet {
  original: string;
  improved: string;
}

export interface AnalysisResult {
  analysis_mode: "general" | "job_match";
  /** false when the AI review failed and only rule-based results are included */
  ai_review_available?: boolean;
  ai_review_error?: string | null;
  scores: {
    deterministic_rule_score: number;
    ai_review_score: number | null;
    job_match_score: number | null;
  };
  score_gap_insight: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: AnalysisSuggestion[];
  improved_bullets: ImprovedBullet[];
}

type BulletSection = "experience" | "projects" | "research";

export type TextLocation =
  | { kind: "bullet"; section: BulletSection; entryId: string; bulletIndex: number }
  | { kind: "achievement"; entryId: string }
  | { kind: "summary" };

/** Lowercase, unify dashes/quotes, drop bullet markers, collapse whitespace and trailing punctuation. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/^[\s•\-*·]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.;,]+$/, "")
    .trim();
}

/** Find where `original` lives in the resume. Returns null when it isn't found or is ambiguous. */
export function locateText(resume: Resume, original: string): TextLocation | null {
  const target = normalizeForMatch(original);
  if (!target) return null;
  const matches: TextLocation[] = [];

  for (const section of ["experience", "projects", "research"] as const) {
    for (const entry of resume[section] || []) {
      (entry.bullets || []).forEach((bullet, bulletIndex) => {
        if (normalizeForMatch(bullet) === target) {
          matches.push({ kind: "bullet", section, entryId: entry.id, bulletIndex });
        }
      });
    }
  }
  for (const achievement of resume.achievements || []) {
    if (achievement.description && normalizeForMatch(achievement.description) === target) {
      matches.push({ kind: "achievement", entryId: achievement.id });
    }
  }
  if (resume.summary?.text && normalizeForMatch(resume.summary.text) === target) {
    matches.push({ kind: "summary" });
  }

  return matches.length === 1 ? matches[0] : null;
}

/** Current text at a location, or undefined if the entry no longer exists. */
export function readText(resume: Resume, loc: TextLocation): string | undefined {
  if (loc.kind === "summary") return resume.summary?.text;
  if (loc.kind === "achievement") {
    return resume.achievements.find((a) => a.id === loc.entryId)?.description;
  }
  return resume[loc.section]?.find((e) => e.id === loc.entryId)?.bullets?.[loc.bulletIndex];
}

/** Return a copy of the resume with the text at `loc` replaced. */
export function writeText(resume: Resume, loc: TextLocation, text: string): Resume {
  if (loc.kind === "summary") {
    return { ...resume, summary: { ...resume.summary, text } };
  }
  if (loc.kind === "achievement") {
    return {
      ...resume,
      achievements: resume.achievements.map((a) =>
        a.id === loc.entryId ? { ...a, description: text } : a,
      ),
    };
  }
  const entries = resume[loc.section] as { id: string; bullets: string[] }[];
  return {
    ...resume,
    [loc.section]: entries.map((e) =>
      e.id === loc.entryId
        ? { ...e, bullets: e.bullets.map((b, i) => (i === loc.bulletIndex ? text : b)) }
        : e,
    ),
  };
}

/** Builder sidebar section that holds a location. */
export function locationSection(loc: TextLocation): BuilderSection {
  if (loc.kind === "summary") return "Profile";
  if (loc.kind === "achievement") return "Achievements";
  return ({ experience: "Experience", projects: "Projects", research: "Research" } as const)[loc.section];
}

/** Short human label, e.g. "Experience · Google". */
export function locationLabel(resume: Resume, loc: TextLocation): string {
  if (loc.kind === "summary") return "Summary";
  if (loc.kind === "achievement") {
    const a = resume.achievements.find((x) => x.id === loc.entryId);
    return `Achievements${a?.title ? ` · ${a.title}` : ""}`;
  }
  const entry = resume[loc.section]?.find((e) => e.id === loc.entryId) as
    | { company?: string; title?: string }
    | undefined;
  const name = entry?.company || entry?.title;
  return `${locationSection(loc)}${name ? ` · ${name}` : ""}`;
}

/** Fingerprint used to tell whether results are out of date (template changes the PDF too). */
export function resumeFingerprint(resume: Resume): string {
  return JSON.stringify(resume);
}
