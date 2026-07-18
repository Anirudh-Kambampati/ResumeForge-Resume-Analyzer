import { Resume } from "@/types/resume";

// ============================================================
// Shared Layout Configuration
// Single source of truth for both Preview (HTML/CSS) and PDF
// All numeric values are in PT (points) for cross-renderer consistency.
// ============================================================

export type ResumeDensity = "comfortable" | "compact" | "dense" | "ultraCompact";

export interface ResumeLayout {
  pagePadding: number;
  headerPaddingBottom: number;
  nameFontSize: number;
  nameLineHeight: number;
  titleFontSize: number;
  titleMarginTop: number;
  titleLetterSpacing: number;
  contactFontSize: number;
  contactRowGap: number;
  sectionMarginTop: number;
  sectionHeaderFontSize: number;
  sectionHeaderBorderWidth: number; // bottom-border
  sectionHeaderPaddingBottom: number;
  sectionHeaderMarginBottom: number;
  sectionHeaderLetterSpacing: number;
  entryGap: number;
  entryTitleFontSize: number;
  entryTitleLineHeight: number;
  entrySubtitleFontSize: number;
  entryMetaFontSize: number;
  bulletListMarginTop: number;
  bulletListPaddingLeft: number;
  bulletGap: number;
  bulletFontSize: number;
  bulletLineHeight: number;
  bodyTextFontSize: number;
  bodyTextLineHeight: number;
  bodyTextMarginTop: number;
  skillsMarginTop: number;
  skillsItemFontSize: number;
  skillsItemLineHeight: number;
  skillsItemMarginBottom: number;
  achievementsListMarginTop: number;
  achievementsPaddingLeft: number;
  achievementsItemFontSize: number;
  achievementsItemLineHeight: number;
  achievementsItemMarginBottom: number;
  certificationsMarginTop: number;
  certificationsGap: number;
  certificationsItemFontSize: number;
  certificationsItemLineHeight: number;
  languagesMarginTop: number;
  languagesGap: number;
  languagesItemFontSize: number;
  languagesItemLineHeight: number;
}

// ============================================================
// Density presets
// Derived from the browser preview's densityStyles, converted to pt.
// 1mm ≈ 2.83pt, 1px = 0.75pt
// ============================================================

const layoutPresets: Record<ResumeDensity, ResumeLayout> = {
  comfortable: {
    pagePadding: 45,           // ~16mm (was 20mm — reclaims 24pt vertical)
    headerPaddingBottom: 12,   // 16px — unchanged
    nameFontSize: 24,
    nameLineHeight: 1.2,
    titleFontSize: 11,
    titleMarginTop: 5,         // 6.7px (was 4px — more breathing name→title)
    titleLetterSpacing: 1.5,
    contactFontSize: 9,
    contactRowGap: 9,          // 12px — unchanged
    sectionMarginTop: 16,      // 21.3px (was 20px — slight increase to maintain section separation)
    sectionHeaderFontSize: 10.5,  // bumped +0.5pt — clearly larger than entry titles
    sectionHeaderBorderWidth: 1.5,
    sectionHeaderPaddingBottom: 3, // 4px — unchanged
    sectionHeaderMarginBottom: 7.5, // 10px (was 8px — more room heading→first entry)
    sectionHeaderLetterSpacing: 1,
    entryGap: 9,               // 12px (was 10px — more breathing between entries)
    entryTitleFontSize: 10,
    entryTitleLineHeight: 1.4,
    entrySubtitleFontSize: 10,
    entryMetaFontSize: 9,      // reduced -0.5pt — metadata distinct from body (9.5)
    bulletListMarginTop: 6,    // 8px (was 6px — more space entry title→bullets)
    bulletListPaddingLeft: 12, // 16px — unchanged
    bulletGap: 4,              // 5.3px (was 4px — better bullet separation)
    bulletFontSize: 9.5,
    bulletLineHeight: 1.4,
    bodyTextFontSize: 9.5,
    bodyTextLineHeight: 1.4,
    bodyTextMarginTop: 5,      // 6.7px (was 6px — slight increase)
    skillsMarginTop: 6,        // 8px (was 6px — also affects contact→header spacing)
    skillsItemFontSize: 9.5,
    skillsItemLineHeight: 1.4,
    skillsItemMarginBottom: 4, // 5.3px (was 4px — more skill-row separation)
    achievementsListMarginTop: 4.5, // 6px — unchanged
    achievementsPaddingLeft: 12,    // 16px — unchanged
    achievementsItemFontSize: 9.5,
    achievementsItemLineHeight: 1.4,
    achievementsItemMarginBottom: 3, // 4px — unchanged
    certificationsMarginTop: 4.5,    // 6px — unchanged
    certificationsGap: 12,           // 16px — unchanged
    certificationsItemFontSize: 9.5,
    certificationsItemLineHeight: 1.4,
    languagesMarginTop: 4.5,         // 6px — unchanged
    languagesGap: 9,                 // 12px — unchanged
    languagesItemFontSize: 9.5,
    languagesItemLineHeight: 1.4,
  },
  compact: {
    pagePadding: 34,           // ~12mm (was 15mm — reclaims 16pt vertical)
    headerPaddingBottom: 9,    // 12px — unchanged
    nameFontSize: 24,
    nameLineHeight: 1.2,
    titleFontSize: 10.5,
    titleMarginTop: 4,         // 5.3px (was 3px)
    titleLetterSpacing: 1.25,
    contactFontSize: 8.75,
    contactRowGap: 7.5,        // 10px — unchanged
    sectionMarginTop: 13,      // 17.3px (was 16px)
    sectionHeaderFontSize: 10, // bumped +0.5pt
    sectionHeaderBorderWidth: 1.5,
    sectionHeaderPaddingBottom: 2.25, // 3px — unchanged
    sectionHeaderMarginBottom: 6,     // 8px (was 6px)
    sectionHeaderLetterSpacing: 0.9,
    entryGap: 7.5,             // 10px (was 8px)
    entryTitleFontSize: 9.5,
    entryTitleLineHeight: 1.3,
    entrySubtitleFontSize: 9.5,
    entryMetaFontSize: 8.5,    // reduced -0.5pt
    bulletListMarginTop: 4.5,  // 6px (was 4px)
    bulletListPaddingLeft: 10.5, // 14px — unchanged
    bulletGap: 3,              // 4px (was 3px)
    bulletFontSize: 9.2,
    bulletLineHeight: 1.3,
    bodyTextFontSize: 9.2,
    bodyTextLineHeight: 1.3,
    bodyTextMarginTop: 4,      // 5.3px (was 4px)
    skillsMarginTop: 4.5,      // 6px (was 4px)
    skillsItemFontSize: 9.2,
    skillsItemLineHeight: 1.3,
    skillsItemMarginBottom: 3, // 4px (was 3px)
    achievementsListMarginTop: 3,  // 4px — unchanged
    achievementsPaddingLeft: 10.5, // 14px — unchanged
    achievementsItemFontSize: 9.2,
    achievementsItemLineHeight: 1.3,
    achievementsItemMarginBottom: 2.25, // 3px — unchanged
    certificationsMarginTop: 3,  // 4px — unchanged
    certificationsGap: 9,        // 12px — unchanged
    certificationsItemFontSize: 9.2,
    certificationsItemLineHeight: 1.3,
    languagesMarginTop: 3,       // 4px — unchanged
    languagesGap: 7.5,           // 10px — unchanged
    languagesItemFontSize: 9.2,
    languagesItemLineHeight: 1.3,
  },
  dense: {
    pagePadding: 28,           // ~10mm (was 12mm — reclaims 12pt vertical)
    headerPaddingBottom: 6,    // 8px — unchanged
    nameFontSize: 24,
    nameLineHeight: 1.1,
    titleFontSize: 10.5,
    titleMarginTop: 3,         // 4px (was 2px)
    titleLetterSpacing: 1,
    contactFontSize: 8.75,
    contactRowGap: 6,          // 8px — unchanged
    sectionMarginTop: 10,      // 13.3px (was 12px)
    sectionHeaderFontSize: 9.5, // bumped +0.5pt
    sectionHeaderBorderWidth: 1,
    sectionHeaderPaddingBottom: 1.5, // 2px — unchanged
    sectionHeaderMarginBottom: 4.5,  // 6px (was 4px)
    sectionHeaderLetterSpacing: 0.8,
    entryGap: 6,               // 8px (was 6px)
    entryTitleFontSize: 9,
    entryTitleLineHeight: 1.2,
    entrySubtitleFontSize: 9,
    entryMetaFontSize: 8,      // reduced -0.5pt
    bulletListMarginTop: 3.5,  // 4.7px (was 3px)
    bulletListPaddingLeft: 9,  // 12px — unchanged
    bulletGap: 2.25,           // 3px (was 2px)
    bulletFontSize: 8.8,
    bulletLineHeight: 1.25,
    bodyTextFontSize: 8.8,
    bodyTextLineHeight: 1.25,
    bodyTextMarginTop: 3,      // 4px (was 3px)
    skillsMarginTop: 3.5,      // 4.7px (was 3px)
    skillsItemFontSize: 8.8,
    skillsItemLineHeight: 1.25,
    skillsItemMarginBottom: 2.25, // 3px (was 2px)
    achievementsListMarginTop: 2.25, // 3px — unchanged
    achievementsPaddingLeft: 9,     // 12px — unchanged
    achievementsItemFontSize: 8.8,
    achievementsItemLineHeight: 1.25,
    achievementsItemMarginBottom: 1.5, // 2px — unchanged
    certificationsMarginTop: 2.25, // 3px — unchanged
    certificationsGap: 6,          // 8px — unchanged
    certificationsItemFontSize: 8.8,
    certificationsItemLineHeight: 1.25,
    languagesMarginTop: 2.25, // 3px — unchanged
    languagesGap: 6,          // 8px — unchanged
    languagesItemFontSize: 8.8,
    languagesItemLineHeight: 1.25,
  },
  ultraCompact: {
    pagePadding: 22,           // ~8mm (was 10mm — reclaims 12pt vertical)
    headerPaddingBottom: 4.5,  // 6px — unchanged
    nameFontSize: 24,
    nameLineHeight: 1.1,
    titleFontSize: 10.5,
    titleMarginTop: 2.25,      // 3px (was 2px)
    titleLetterSpacing: 0.8,
    contactFontSize: 8.75,
    contactRowGap: 4.5,        // 6px — unchanged
    sectionMarginTop: 7,       // 9.3px (was 8px)
    sectionHeaderFontSize: 9,  // bumped +0.5pt
    sectionHeaderBorderWidth: 1,
    sectionHeaderPaddingBottom: 0.75, // 1px — unchanged
    sectionHeaderMarginBottom: 3.5,   // 4.7px (was 3px)
    sectionHeaderLetterSpacing: 0.7,
    entryGap: 4.5,             // 6px (was 4px)
    entryTitleFontSize: 8.5,
    entryTitleLineHeight: 1.2,
    entrySubtitleFontSize: 8.5,
    entryMetaFontSize: 7.5,    // reduced -0.5pt
    bulletListMarginTop: 2.25, // 3px (was 2px)
    bulletListPaddingLeft: 7.5, // 10px — unchanged
    bulletGap: 1.5,            // 2px (was 1px)
    bulletFontSize: 8.5,
    bulletLineHeight: 1.2,
    bodyTextFontSize: 8.5,
    bodyTextLineHeight: 1.2,
    bodyTextMarginTop: 2.25,   // 3px (was 2px)
    skillsMarginTop: 2.25,     // 3px (was 2px)
    skillsItemFontSize: 8.5,
    skillsItemLineHeight: 1.2,
    skillsItemMarginBottom: 1.5, // 2px (was 1px)
    achievementsListMarginTop: 1.5, // 2px — unchanged
    achievementsPaddingLeft: 7.5,   // 10px — unchanged
    achievementsItemFontSize: 8.5,
    achievementsItemLineHeight: 1.2,
    achievementsItemMarginBottom: 0.75, // 1px — unchanged
    certificationsMarginTop: 1.5, // 2px — unchanged
    certificationsGap: 4.5,       // 6px — unchanged
    certificationsItemFontSize: 8.5,
    certificationsItemLineHeight: 1.2,
    languagesMarginTop: 1.5, // 2px — unchanged
    languagesGap: 4.5,       // 6px — unchanged
    languagesItemFontSize: 8.5,
    languagesItemLineHeight: 1.2,
  },
};

// ============================================================
// Section order — single source of truth
// ============================================================

export const SECTION_ORDER = [
  "Summary",
  "Experience",
  "Education",
  "Projects",
  "Research",
  "Publications",
  "Skills",
  "Achievements",
  "Certifications",
  "Languages",
] as const;

export type SectionName = (typeof SECTION_ORDER)[number];

// ============================================================
// Color palette — shared across renderers
// ============================================================

export const COLORS = {
  textPrimary: "#171717",      // neutral-900
  textSecondary: "#525252",    // neutral-600
  textTertiary: "#737373",     // neutral-500
  textBody: "#404040",         // neutral-700
  textMuted: "#a3a3a3",       // neutral-400 — lowest-priority metadata (pipes, dates)
  border: "#262626",           // neutral-800
  borderLight: "#d4d4d4",     // neutral-300
  white: "#ffffff",
} as const;

// ============================================================
// Helpers
// ============================================================

export function getResumeDensity(resume: Resume): ResumeDensity {
  let score = 0;

  const contactInfoCount = [
    resume.profile?.email,
    resume.profile?.phone,
    resume.profile?.location,
    ...(resume.profile?.links || []),
  ].filter(Boolean).length;
  score += contactInfoCount * 0.5;

  if (resume.summary?.enabled && resume.summary.text?.trim()) {
    score += 3;
    score += resume.summary.text.trim().length / 60;
  }

  const activeExp = (resume.experience || []).filter((job) => job.enabled);
  if (activeExp.length > 0) {
    score += 3;
    for (const job of activeExp) {
      score += 3;
      const bullets = (job.bullets || []).filter((b) => b.trim());
      for (const bullet of bullets) {
        score += 1;
        score += bullet.trim().length / 80;
      }
    }
  }

  const activeProjects = (resume.projects || []).filter((p) => p.enabled);
  if (activeProjects.length > 0) {
    score += 3;
    for (const p of activeProjects) {
      score += 3;
      const bullets = (p.bullets || []).filter((b) => b.trim());
      for (const bullet of bullets) {
        score += 1;
        score += bullet.trim().length / 80;
      }
    }
  }

  const activeResearch = (resume.research || []).filter((r) => r.enabled);
  if (activeResearch.length > 0) {
    score += 3;
    for (const r of activeResearch) {
      score += 3;
      const bullets = (r.bullets || []).filter((b) => b.trim());
      for (const bullet of bullets) {
        score += 1;
        score += bullet.trim().length / 80;
      }
    }
  }

  const activePubs = (resume.publications || []).filter((p) => p.enabled);
  if (activePubs.length > 0) {
    score += 3;
    score += activePubs.length * 2;
    for (const pub of activePubs) {
      if (pub.description?.trim()) {
        score += 1;
        score += pub.description.trim().length / 80;
      }
    }
  }

  const activeEdu = (resume.education || []).filter((e) => e.enabled);
  if (activeEdu.length > 0) {
    score += 3;
    score += activeEdu.length * 3.5;
  }

  const activeSkills = (resume.skills || []).filter(
    (cat) => cat.title && cat.items?.length > 0
  );
  if (activeSkills.length > 0) {
    score += 3;
    for (const cat of activeSkills) {
      score += 1.5;
      score += cat.items.length * 0.2;
    }
  }

  const activeAch = (resume.achievements || []).filter((a) => a.enabled);
  if (activeAch.length > 0) {
    score += 3;
    score += activeAch.length * 2;
  }

  const activeCert = (resume.certifications || []).filter((c) => c.enabled);
  if (activeCert.length > 0) {
    score += 3;
    score += activeCert.length * 1.25;
  }

  const activeLang = (resume.languages || []).filter(
    (l) => l.enabled && (l.name || l.proficiency)
  );
  if (activeLang.length > 0) {
    score += 3;
    score += activeLang.length * 1;
  }

  if (score <= 40) return "comfortable";
  if (score <= 55) return "compact";
  if (score <= 72) return "dense";
  return "ultraCompact";
}

export function getResumeLayout(resume: Resume): ResumeLayout {
  const density = getResumeDensity(resume);
  return layoutPresets[density];
}
