// ============================================================
// ATS Import — upload a PDF resume and convert the LLM-parsed
// output into a full Resume object the builder can consume.
//
// The backend /api/ats/optimize endpoint returns data matching
// the frontend Resume type but WITHOUT builder-only fields:
//   - id (both resume-level and per-section)
//   - enabled (on each section item)
//   - template, layout, sectionOrder, customSections
//
// This module fills those gaps so the user lands on /builder
// with a fully populated, ready-to-edit resume.
// ============================================================

import { Resume } from "@/types/resume";
import { getLayoutSections } from "@/config/layouts";

// ============================================================
// ID generation — simple counter-based to keep IDs predictable
// during a single session. Never persisted.
// ============================================================

let _idCounter = 0;

function uid(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${_idCounter}-${Date.now().toString(36)}`;
}

// ============================================================
// Response type from /api/ats/optimize
// ============================================================

export interface AtsOptimizeResponse {
  profile?: {
    fullName?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: Array<{
      label?: string;
      url?: string;
      username?: string;
    }>;
  };
  summary?: {
    text?: string;
  } | string;
  experience?: Array<{
    company?: string;
    role?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    currentlyWorking?: boolean;
    bullets?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    field?: string;
    grade?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: Array<{
    title?: string;
    items?: string[];
  }>;
  projects?: Array<{
    title?: string;
    link?: string;
    technologies?: string[];
    bullets?: string[];
  }>;
  achievements?: string[] | Array<{
    title?: string;
    description?: string;
  }>;
  certifications?: Array<{
    title?: string;
    issuer?: string;
    date?: string;
    credentialId?: string;
  }>;
  languages?: Array<{
    name?: string;
    proficiency?: string;
  }>;
  research?: Array<{
    title?: string;
    institution?: string;
    advisor?: string;
    duration?: string;
    link?: string;
    keywords?: string[];
    bullets?: string[];
  }>;
  publications?: Array<{
    title?: string;
    authors?: string;
    venue?: string;
    date?: string;
    doi?: string;
    keywords?: string[];
    description?: string;
  }>;
}

// ============================================================
// Transform API response → full Resume
// ============================================================

export function atsResponseToResume(response: AtsOptimizeResponse): Resume {
  const sectionOrder = [...getLayoutSections("ats")];

  const resume: Resume = {
    id: uid("resume"),
    template: "ats",
    layout: "ats",
    sectionOrder,
    profile: {
      fullName: response.profile?.fullName ?? "",
      titles: splitTitles(response.profile?.title ?? ""),
      email: response.profile?.email ?? "",
      phone: response.profile?.phone ?? "",
      location: response.profile?.location ?? "",
      links: (response.profile?.links ?? []).map((l) => ({
        label: l.label ?? "",
        url: l.url ?? "",
        username: l.username ?? "",
      })),
    },
    summary: {
      id: "summary",
      enabled: true,
      text:
        typeof response.summary === "string"
          ? response.summary
          : response.summary?.text ?? "",
    },
    experience: (response.experience ?? []).map((exp) => ({
      id: uid("exp"),
      enabled: true,
      company: exp.company ?? "",
      role: exp.role ?? "",
      location: exp.location ?? "",
      startDate: exp.startDate ?? "",
      endDate: exp.endDate ?? "",
      currentlyWorking: exp.currentlyWorking ?? false,
      bullets: exp.bullets ?? [],
    })),
    education: (response.education ?? []).map((edu) => ({
      id: uid("edu"),
      enabled: true,
      institution: edu.institution ?? "",
      degree: edu.degree ?? "",
      field: edu.field ?? "",
      grade: edu.grade ?? "",
      startDate: edu.startDate ?? "",
      endDate: edu.endDate ?? "",
    })),
    skills: (response.skills ?? []).map((skill) => ({
      id: uid("skill"),
      title: skill.title ?? "",
      items: skill.items ?? [],
    })),
    projects: (response.projects ?? []).map((proj) => ({
      id: uid("proj"),
      enabled: true,
      title: proj.title ?? "",
      link: proj.link ?? "",
      technologies: proj.technologies ?? [],
      bullets: proj.bullets ?? [],
    })),
    achievements: ((response.achievements ?? []) as (string | { title?: string; description?: string })[]).map(
      (ach) => ({
        id: uid("ach"),
        enabled: true,
        title: typeof ach === "string" ? ach : ach?.title ?? "",
        description: typeof ach === "string" ? "" : ach?.description ?? "",
      })
    ),
    certifications: (response.certifications ?? []).map((cert) => ({
      id: uid("cert"),
      enabled: true,
      title: cert.title ?? "",
      issuer: cert.issuer ?? "",
      date: cert.date ?? "",
      credentialId: cert.credentialId ?? "",
    })),
    languages: (response.languages ?? []).map((lang) => ({
      id: uid("lang"),
      enabled: true,
      name: lang.name ?? "",
      proficiency: lang.proficiency ?? "",
    })),
    research: (response.research ?? []).map((r) => ({
      id: uid("research"),
      enabled: true,
      title: r.title ?? "",
      institution: r.institution ?? "",
      advisor: r.advisor ?? "",
      duration: r.duration ?? "",
      link: r.link ?? "",
      keywords: r.keywords ?? [],
      bullets: r.bullets ?? [],
    })),
    publications: (response.publications ?? []).map((pub) => ({
      id: uid("pub"),
      enabled: true,
      title: pub.title ?? "",
      authors: pub.authors ?? "",
      venue: pub.venue ?? "",
      date: pub.date ?? "",
      doi: pub.doi ?? "",
      keywords: pub.keywords ?? [],
      description: pub.description ?? "",
    })),
    customSections: [],
  };

  return resume;
}

// ============================================================
// Link classification — strict priority for profile vs project
// ============================================================

// Known platform domains — never a portfolio link
const PROFILE_PLATFORM_DOMAINS = [
  "github.com",
  "linkedin.com",
  "leetcode.com",
  "codeforces.com",
  "x.com",
  "twitter.com",
  "hackerrank.com",
  "gitlab.com",
  "bitbucket.org",
];

// Known deployment / demo platforms — always a project link, never portfolio
const DEPLOY_DOMAINS = [
  "vercel.app",
  "netlify.app",
  "netlify.com",
  "pages.dev",
  "render.com",
  "fly.dev",
  "railway.app",
  "cyclic.app",
  "replit.com",
  "onrender.com",
  "github.io",
  "gitlab.io",
  "herokuapp.com",
  "pythonanywhere.com",
  "streamlit.app",
  "huggingface.co",
];

// Common coding / project keywords in domain names — reject from portfolio
const CODING_KEYWORDS = ["github", "gitlab", "bitbucket", "codesandbox", "codepen", "glitch"];

/**
 * Determine if a URL is a genuine personal website (belongs in profile links).
 * Strict rejects: known platforms, deploy platforms, repo URLs, coding domains.
 */
function isGenuinePortfolio(url: string): boolean {
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withProto);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/$/, "");

    // Reject known platforms
    if (PROFILE_PLATFORM_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return false;
    }

    // Reject deployment / demo platforms
    if (DEPLOY_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return false;
    }

    // Reject GitHub/GitLab repo URLs (hostname + 2+ path segments => user/repo)
    if ((hostname === "github.com" || hostname === "gitlab.com") && path.split("/").filter(Boolean).length >= 2) {
      return false;
    }

    // Reject hostnames with coding keywords
    if (CODING_KEYWORDS.some((kw) => hostname.includes(kw))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Determine if a URL looks like a project-specific link (repo or deployment).
 * These should NEVER go in profile.links.
 */
function isProjectLink(url: string): boolean {
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withProto);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/$/, "");

    // GitHub/GitLab repo: hostname + user/repo (2+ path segments)
    if ((hostname === "github.com" || hostname === "gitlab.com" || hostname === "bitbucket.org")
        && path.split("/").filter(Boolean).length >= 2) {
      return true;
    }

    // Known deployment domains
    if (DEPLOY_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Strip project-looking URLs from the profile links array.
 * A profile link should only contain:
 *   - Email (handled separately)
 *   - LinkedIn
 *   - GitHub profile (single user, NOT a repo)
 *   - Genuine personal website (strictly validated)
 *   - Other platform profiles (X/Twitter, LeetCode, etc.)
 */
function classifyProfileLinks(
  links: { label: string; url: string; username?: string }[]
): { label: string; url: string; username?: string }[] {
  return links.filter((link) => {
    const url = link.url?.trim();
    if (!url) return false;

    const label = link.label || "";
    const labelLower = label.toLowerCase();

    // Always keep known platform profiles
    if (["linkedin", "github", "x (twitter)", "twitter", "leetcode", "codeforces", "hackerrank"]
        .some((p) => labelLower.includes(p))) {
      // For GitHub, only keep if it's a profile (user), not a repo
      if (labelLower === "github" || labelLower.includes("github")) {
        return !isProjectLink(url);
      }
      return true;
    }

    // Portfolio: only keep if genuinely a personal website
    if (labelLower === "portfolio" || labelLower === "website" || labelLower === "personal website") {
      return isGenuinePortfolio(url);
    }

    // For any other label, check: if it looks like a project link, reject it
    if (isProjectLink(url)) {
      return false;
    }

    // Keep links that pass the personal website check
    return isGenuinePortfolio(url);
  });
}

// ============================================================
// Title splitting
// ============================================================

/** Split a raw title string into multiple titles by common separators.
 *
 * Recognized separators:  |  •  /  ·
 * Trims whitespace, ignores empty entries, deduplicates case-insensitively. */
function splitTitles(raw: string): string[] {
  if (!raw.trim()) return [];

  // Split on any of the recognized separators (with optional surrounding whitespace)
  const parts = raw.split(/\s*[|•\/·]\s*/).map((s) => s.trim()).filter(Boolean);

  // Deduplicate case-insensitively while preserving order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

// ============================================================
// Upload a PDF and parse it through the ATS pipeline
// ============================================================

export async function uploadAndParseResume(
  file: File,
  signal?: AbortSignal,
): Promise<Resume> {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/ats/optimize`,
    {
      method: "POST",
      body: formData,
      signal,
    },
  );

  if (!response.ok) {
    let detail = `Server returned ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) detail = err.detail;
    } catch {
      // ignore parse failure
    }
    throw new Error(detail);
  }

  const data: AtsOptimizeResponse = await response.json();
  let resume = atsResponseToResume(data);

  // Post-process: classify profile links with strict priority
  // Strip any project-looking URLs from profile.links
  resume = {
    ...resume,
    profile: {
      ...resume.profile,
      links: classifyProfileLinks(resume.profile.links || []),
    },
  };

  // Persist to localStorage so the builder can pick it up
  localStorage.setItem("resumeforge-resume", JSON.stringify(resume));

  return resume;
}


