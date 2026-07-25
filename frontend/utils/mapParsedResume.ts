"use client";

import { Resume } from "@/types/resume";
import { detectPlatform, extractUsername } from "@/lib/contactLinks";

// ============================================================
// ParsedResume — exact shape returned by backend /api/parse
// ============================================================

export interface ParsedResume {
  profile?: {
    fullName?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary?: string;
  education?: {
    degree?: string;
    institution?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
  }[];
  experience?: {
    company?: string;
    role?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    currentlyWorking?: boolean;
    bullets?: string[];
  }[];
  projects?: {
    title?: string;
    technologies?: string[];
    description?: string;
    link?: string;
  }[];
  skills?: {
    category?: string;
    items?: string[];
  }[];
  achievements?: {
    title?: string;
    description?: string;
  }[];
  certifications?: {
    title?: string;
    issuer?: string;
    date?: string;
  }[];
  languages?: {
    name?: string;
    proficiency?: string;
  }[];
  research?: {
    title?: string;
    institution?: string;
    description?: string;
  }[];
  publications?: {
    title?: string;
    authors?: string;
    venue?: string;
    date?: string;
    description?: string;
  }[];
}

// ============================================================
// URL-to-username helpers — purely deterministic, no AI
// ============================================================

function makeLinkWithUsername(label: string, url: string): { label: string; url: string; username?: string } {
  const normalized = url.trim();
  const href = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
  const platform = detectPlatform(href);
  const username = platform ? extractUsername(href, platform) : "";
  return {
    label,
    url: normalized,
    ...(username ? { username } : {}),
  };
}

// ============================================================
// Deterministic ID generation
// ============================================================

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-import-${counter}-${Date.now()}`;
}

// ============================================================
// Safe coercion helpers — never crash, never fabricate
// ============================================================

function str(val: unknown): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

function arr(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((item) => str(item)).filter(Boolean);
  return [];
}

// ============================================================
// Known platform domains — never put these in Portfolio
// ============================================================

const KNOWN_PLATFORM_DOMAINS = [
  "github.com",
  "linkedin.com",
  "leetcode.com",
  "codeforces.com",
  "x.com",
  "twitter.com",
  "hackerrank.com",
];

// ============================================================
// Validate portfolio URL
// Returns true ONLY if the URL is a genuine personal website:
//   1. Hostname is NOT a known platform
//   2. The URL does NOT appear in any project entry's link
// ============================================================

function isLikelyPersonalWebsite(url: string, allProjects: { link?: string }[]): boolean {
  const lower = url.toLowerCase().trim();

  // Extract normalized hostname
  let hostname = "";
  try {
    hostname = new URL(/^https?:\/\//i.test(lower) ? lower : `https://${lower}`).hostname.replace(/^www\./, "");
  } catch {
    return false; // Invalid URL — not a portfolio
  }

  // Reject if it's a known platform domain
  if (KNOWN_PLATFORM_DOMAINS.includes(hostname)) return false;

  // Reject if the same URL appears in any project entry
  for (const proj of allProjects) {
    if (!proj.link) continue;
    const projNorm = proj.link.toLowerCase().trim();
    // Normalize both URLs and compare exactly
    if (normalizeForComparison(projNorm) === normalizeForComparison(lower)) return false;
  }

  return true;
}

function normalizeForComparison(url: string): string {
  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withProto.replace(/\/$/, "").toLowerCase();
}

// ============================================================
// Default section order for imported resumes
// Only sections with data are included in the final order.
// ============================================================

const IMPORT_SECTION_ORDER: string[] = [
  "Summary",
  "Experience",
  "Education",
  "Projects",
  "Skills",
  "Achievements",
  "Certifications",
  "Languages",
  "Research",
  "Publications",
];

// ============================================================
// Pure mapper: ParsedResume → Resume
//
// RULES:
//  - Accepts NO existing resume — every import starts fresh.
//  - Only populates fields that exist in parsed data.
//  - Never invents, merges, or falls back to existing data.
//  - Empty sections stay as empty arrays (not inherited).
//  - sectionOrder derived from which sections have data.
//  - Profile links preserved as label+url pairs (labels are
//    deterministic: "LinkedIn", "GitHub", "Portfolio").
// ============================================================

export function mapParsedResumeToBuilderData(parsed: ParsedResume): Resume {
  const profileData = parsed.profile || {};

  // ------------------------------------------------------------------
  // Contact links: one entry per known platform with data
  // Extract username automatically from the URL.
  // Priority: embedded URI > visible text > pattern match.
  // ------------------------------------------------------------------
  const links: { label: string; url: string; username?: string }[] = [];
  const linkedin = str(profileData.linkedin);
  const github = str(profileData.github);
  const portfolio = str(profileData.portfolio);
  if (linkedin) links.push(makeLinkWithUsername("LinkedIn", linkedin));
  if (github) links.push(makeLinkWithUsername("GitHub", github));

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const summaryText = str(parsed.summary);
  const hasSummary = !!summaryText;

  // ------------------------------------------------------------------
  // Experience — each entry becomes one card
  // ------------------------------------------------------------------
  const experience = (parsed.experience || [])
    .filter((exp) => str(exp.company) || str(exp.role))
    .map((exp) => ({
      id: uid("exp"),
      enabled: true,
      company: str(exp.company),
      role: str(exp.role),
      location: str(exp.location),
      startDate: str(exp.startDate),
      endDate: str(exp.currentlyWorking ? "" : str(exp.endDate)),
      currentlyWorking: exp.currentlyWorking === true,
      bullets: arr(exp.bullets),
    }));

  // ------------------------------------------------------------------
  // Education — each entry becomes one card
  // ------------------------------------------------------------------
  const education = (parsed.education || [])
    .filter((edu) => str(edu.institution) || str(edu.degree))
    .map((edu) => ({
      id: uid("edu"),
      enabled: true,
      institution: str(edu.institution),
      degree: str(edu.degree),
      field: "", // parser does not distinguish field from degree
      grade: str(edu.gpa),
      startDate: str(edu.startDate),
      endDate: str(edu.endDate),
    }));

  // ------------------------------------------------------------------
  // Projects — import description as individual bullets when possible.
  // If description is multiple lines, split into separate bullets.
  // Each project stays as exactly one project entry.
  // ------------------------------------------------------------------
  const projects = (parsed.projects || [])
    .filter((proj) => str(proj.title))
    .map((proj) => {
      let bullets: string[] = [];
      if (proj.description) {
        const desc = str(proj.description);
        // Split on common bullet separators if present
        const lines = desc
          .split(/\n+|(?:(?:^|[.?!])\s*)(?=[A-Z"'`(\[{])/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length > 1) {
          bullets = lines;
        } else {
          bullets = [desc];
        }
      }
      return {
        id: uid("proj"),
        enabled: true,
        title: str(proj.title),
        link: str(proj.link) || undefined,
        technologies: arr(proj.technologies),
        bullets,
      };
    });

  // ------------------------------------------------------------------
  // Portfolio check — must come AFTER projects since we check
  // whether the portfolio URL appears in any project link.
  // ------------------------------------------------------------------
  if (portfolio && isLikelyPersonalWebsite(portfolio, projects)) {
    links.push(makeLinkWithUsername("Portfolio", portfolio));
  }

  // ------------------------------------------------------------------
  // Skills — only categories with at least one item
  // ------------------------------------------------------------------
  const rawSkills = parsed.skills || [];
  const skills = rawSkills
    .filter((s) => (s.items || []).some((item) => str(item)))
    .map((s) => ({
      id: uid("skill"),
      title: str(s.category) || "Skills",
      items: arr(s.items),
    }));

  // ------------------------------------------------------------------
  // Achievements
  // ------------------------------------------------------------------
  const achievements = (parsed.achievements || [])
    .filter((ach) => str(ach.title) || str(ach.description))
    .map((ach) => ({
      id: uid("ach"),
      enabled: true,
      title: str(ach.title),
      description: str(ach.description),
    }));

  // ------------------------------------------------------------------
  // Certifications
  // ------------------------------------------------------------------
  const certifications = (parsed.certifications || [])
    .filter((cert) => str(cert.title))
    .map((cert) => ({
      id: uid("cert"),
      enabled: true,
      title: str(cert.title),
      issuer: str(cert.issuer),
      date: str(cert.date),
    }));

  // ------------------------------------------------------------------
  // Languages
  // ------------------------------------------------------------------
  const languages = (parsed.languages || [])
    .filter((lang) => str(lang.name))
    .map((lang) => ({
      id: uid("lang"),
      enabled: true,
      name: str(lang.name),
      proficiency: str(lang.proficiency),
    }));

  // ------------------------------------------------------------------
  // Research
  // ------------------------------------------------------------------
  const research = (parsed.research || [])
    .filter((r) => str(r.title))
    .map((r) => ({
      id: uid("research"),
      enabled: true,
      title: str(r.title),
      institution: str(r.institution),
      advisor: "",
      duration: "",
      link: "",
      keywords: [],
      bullets: r.description ? [str(r.description)] : [],
    }));

  // ------------------------------------------------------------------
  // Publications
  // ------------------------------------------------------------------
  const publications = (parsed.publications || [])
    .filter((pub) => str(pub.title))
    .map((pub) => ({
      id: uid("pub"),
      enabled: true,
      title: str(pub.title),
      authors: str(pub.authors),
      venue: str(pub.venue),
      date: str(pub.date),
      doi: "",
      keywords: [],
      description: str(pub.description),
    }));

  // ------------------------------------------------------------------
  // Section order — only include sections with actual data
  // ------------------------------------------------------------------
  const sectionOrder = IMPORT_SECTION_ORDER.filter((section) => {
    switch (section) {
      case "Summary":
        return hasSummary;
      case "Experience":
        return experience.length > 0;
      case "Education":
        return education.length > 0;
      case "Projects":
        return projects.length > 0;
      case "Skills":
        return skills.length > 0;
      case "Achievements":
        return achievements.length > 0;
      case "Certifications":
        return certifications.length > 0;
      case "Languages":
        return languages.length > 0;
      case "Research":
        return research.length > 0;
      case "Publications":
        return publications.length > 0;
      default:
        return false;
    }
  });

  // ------------------------------------------------------------------
  // Assemble and validate final Resume
  // ------------------------------------------------------------------
  const resume: Resume = {
    id: `import-${Date.now()}`,
    template: "ats",
    layout: "ats",
    sectionOrder,
    profile: {
      fullName: str(profileData.fullName),
      title: str(profileData.title),
      email: str(profileData.email),
      phone: str(profileData.phone),
      location: str(profileData.location),
      links,
    },
    summary: {
      id: "summary",
      enabled: hasSummary,
      text: summaryText,
    },
    experience,
    education,
    skills,
    projects,
    achievements,
    certifications,
    languages,
    research,
    publications,
    customSections: [],
  };

  return resume;
}
