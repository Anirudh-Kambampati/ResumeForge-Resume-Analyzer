// ============================================================
// Section Registry
// Single source of truth for section metadata and visibility.
// Preview and PDF both use this to determine which sections render.
// ============================================================

import { Resume } from "@/types/resume";

export interface SectionInfo {
  id: string;
  label: string;
  heading: string;
}

export const ALL_SECTIONS: SectionInfo[] = [
  { id: "Profile", label: "Profile", heading: "" },
  { id: "Experience", label: "Experience", heading: "EXPERIENCE" },
  { id: "Education", label: "Education", heading: "EDUCATION" },
  { id: "Projects", label: "Projects", heading: "PROJECTS" },
  { id: "Research", label: "Research", heading: "RESEARCH" },
  { id: "Publications", label: "Publications", heading: "PUBLICATIONS" },
  { id: "Skills", label: "Skills", heading: "SKILLS" },
  { id: "Achievements", label: "Achievements", heading: "ACHIEVEMENTS" },
  { id: "Certifications", label: "Certifications", heading: "CERTIFICATIONS" },
  { id: "Languages", label: "Languages", heading: "LANGUAGES" },
];

// ============================================================
// Data check — determines whether a section has content to render.
// Preview and PDF both use this to filter empty sections from sectionOrder.
// ============================================================

export function hasSectionData(resume: Resume, sectionId: string): boolean {
  switch (sectionId) {
    case "Experience":
      return (resume.experience || []).some((e) => e.enabled);
    case "Education":
      return (resume.education || []).some((e) => e.enabled);
    case "Projects":
      return (resume.projects || []).some((p) => p.enabled);
    case "Research":
      return (resume.research || []).some((r) => r.enabled);
    case "Publications":
      return (resume.publications || []).some((p) => p.enabled);
    case "Skills":
      return (resume.skills || []).length > 0;
    case "Achievements":
      return (resume.achievements || []).some((a) => a.enabled);
    case "Certifications":
      return (resume.certifications || []).some((c) => c.enabled);
    case "Languages":
      return (resume.languages || []).some(
        (l) => l.enabled && (l.name || l.proficiency)
      );
    default:
      return false;
  }
}
