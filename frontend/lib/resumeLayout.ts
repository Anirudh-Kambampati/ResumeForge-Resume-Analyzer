import { Resume } from "@/types/resume";
import { type TemplateId } from "@/config/templates";

// ============================================================
// Resume Layout — Fixed per-template spacing & typography
//
// Each template defines one clean set of layout values.
// No adaptive spacing. No pressure scores. No interpolation.
// The renderer consumes these values directly.
// ============================================================

export interface ResumeLayout {
  pagePadding: number;
  headerPaddingBottom: number;
  nameFontSize: number;
  nameLineHeight: number;
  nameMarginBottom: number;
  titleFontSize: number;
  titleMarginTop: number;
  titleMarginBottom: number;
  titleLetterSpacing: number;
  contactFontSize: number;
  contactRowGap: number;
  sectionMarginTop: number;
  sectionHeaderFontSize: number;
  sectionHeaderBorderWidth: number;
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
// Fixed Layouts — one per template
//
// IMPORTANT: All three templates share the SAME spacing values.
// The old adaptive engine produced identical layouts for the
// same resume regardless of template (calibration weights were
// tiny corrections). Template visual identity comes from
// TemplateStyles (font weights, size multipliers, letter-spacing,
// border styles) — never from different spacing values.
//
// If you add spacing differences here, you WILL reintroduce
// the page-overflow bug that was fixed by removing the engine.
// ============================================================

// ============================================================
// BASE_LAYOUT — restored to match the last known working
// renderer (commit b67aa7a). Every value here reproduces
// the original inline-spacing object that produced correct
// single-page PDF output for all templates.
//
// Reference (old working renderer):
//   const spacing = {
//     page: 32, headerBottom: 8, section: 7,
//     headingDivider: 2, dividerContent: 4,
//     entry: 4, metadata: 1, bullets: 2,
//     bulletGap: 1, certGap: 12
//   };
// ============================================================

const BASE_LAYOUT: ResumeLayout = {
  // Page & header
  pagePadding: 15,
  headerPaddingBottom: 6,
  nameFontSize: 26,
  nameLineHeight: 1.0,
  nameMarginBottom: 8.5,
  titleFontSize: 11,
  titleMarginTop: 0,
  titleMarginBottom: 2.5,
  titleLetterSpacing: 1.2,
  contactFontSize: 8.5,
  contactRowGap: 4,

  // Sections
  sectionMarginTop: 5.0,
  sectionHeaderFontSize: 9.25,
  sectionHeaderBorderWidth: 0.65,
  sectionHeaderPaddingBottom: 1.5,
  sectionHeaderMarginBottom: 7.0,
  sectionHeaderLetterSpacing: 0.6,

  // Entry spacing
  entryGap: 5.0,
  entryTitleFontSize: 9.0,
  entryTitleLineHeight: 1.2,
  entrySubtitleFontSize: 9.25,
  entryMetaFontSize: 8.5,

  // Bullets
  bulletListMarginTop: 2.5,
  bulletListPaddingLeft: 8,
  bulletGap: 1.0,
  bulletFontSize: 9.0,
  bulletLineHeight: 1.3,

  // Body / summary text
  bodyTextFontSize: 9.5,
  bodyTextLineHeight: 1.3,
  bodyTextMarginTop: 0,

  // Skills
  skillsMarginTop: 1.5,
  skillsItemFontSize: 9.0,
  skillsItemLineHeight: 1.2,
  skillsItemMarginBottom: 0.75,

  // Achievements
  achievementsListMarginTop: 2.0,
  achievementsPaddingLeft: 7,
  achievementsItemFontSize: 9.0,
  achievementsItemLineHeight: 1.2,
  achievementsItemMarginBottom: 0.75,

  // Certifications
  certificationsMarginTop: 0,
  certificationsGap: 8,
  certificationsItemFontSize: 8.5,
  certificationsItemLineHeight: 1.2,

  // Languages
  languagesMarginTop: 0,
  languagesGap: 5,
  languagesItemFontSize: 8.5,
  languagesItemLineHeight: 1.2,
};

const TEMPLATE_LAYOUTS: Record<TemplateId, ResumeLayout> = {
  ats: { ...BASE_LAYOUT },
  faang: { ...BASE_LAYOUT },
  research: { ...BASE_LAYOUT },
};

// ============================================================
// Public API
// ============================================================

/**
 * Returns the fixed layout for the active template.
 * No runtime calculations — each template has one clean set of values.
 */
export function getResumeLayout(resume: Resume): ResumeLayout {
  return TEMPLATE_LAYOUTS[resume.template];
}

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
  textPrimary: "#171717",
  textSecondary: "#525252",
  textTertiary: "#737373",
  textBody: "#404040",
  textMuted: "#a3a3a3",
  border: "#262626",
  borderLight: "#d4d4d4",
  white: "#ffffff",
} as const;
