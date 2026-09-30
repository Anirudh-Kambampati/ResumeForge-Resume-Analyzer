import { Resume } from "@/types/resume";
import { type TemplateId } from "@/config/templates";

// ============================================================
// Resume Layout — Base spacing & typography
//
// The Auto Fit engine (autoFitEngine.ts) applies progressive
// compression on top of BASE_LAYOUT to fit content on one page.
// Both Preview (HTML) and PDF (react-pdf) consume the same
// layout values so they produce identical results.
//
// IMPORTANT: All three templates share BASE_LAYOUT.
// Template visual identity comes from TemplateStyles
// (font weights, size multipliers, letter-spacing, border styles)
// — never from different spacing values.
// ============================================================

export interface ResumeLayout {
  pagePadding: number;
  headerPaddingBottom: number;
  nameFontSize: number;
  nameLineHeight: number;
  nameMarginBottom: number;
  titleFontSize: number;
  titleLineHeight: number;
  /** Extra gap above the titles line (added to nameMarginBottom) */
  titleMarginTop: number;
  /** Gap between the titles line and the contact row */
  titleMarginBottom: number;
  titleLetterSpacing: number;
  contactFontSize: number;
  contactLineHeight: number;
  /** Vertical gap between wrapped lines of the contact row */
  contactRowGap: number;
  /** Horizontal gap between contact items */
  contactItemGap: number;
  /** Gap between a contact item's icon and its text */
  contactIconGap: number;
  /** Icon size as a multiple of contactFontSize */
  contactIconScale: number;

  // Column layout (two-column templates)
  columnGap: number;
  columnWidthLeft: number;  // fraction (e.g. 0.65 = 65%)
  columnWidthRight: number; // fraction (e.g. 0.35 = 35%)

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
  /** Horizontal gap between the two certification columns */
  certificationsColumnGap: number;
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

export const BASE_LAYOUT: ResumeLayout = {
  // Page & header
  // Header lines: name → titles → contact row, then headerPaddingBottom
  // before the first section (which adds its own sectionMarginTop).
  pagePadding: 32,
  headerPaddingBottom: 5,
  nameFontSize: 22,
  nameLineHeight: 1.1,
  nameMarginBottom: 2.5,
  titleFontSize: 10.5,
  titleLineHeight: 1.25,
  titleMarginTop: 1.5,
  titleMarginBottom: 4.5,
  titleLetterSpacing: 0,
  contactFontSize: 8.5,
  contactLineHeight: 1.3,
  contactRowGap: 2.5,
  contactItemGap: 14,
  contactIconGap: 3.5,
  contactIconScale: 1.15,

  // Column layout (inert for single-column templates)
  columnGap: 0,
  columnWidthLeft: 1,
  columnWidthRight: 0,

  // Sections — tighter gaps
  sectionMarginTop: 4.5,
  sectionHeaderFontSize: 10,
  sectionHeaderBorderWidth: 0.65,
  sectionHeaderPaddingBottom: 1.5,
  sectionHeaderMarginBottom: 4.5,
  sectionHeaderLetterSpacing: 0,

  // Entry spacing
  entryGap: 4.5,
  entryTitleFontSize: 9.5,
  entryTitleLineHeight: 1.2,
  entrySubtitleFontSize: 10,
  entryMetaFontSize: 9,

  // Bullets — tighter
  bulletListMarginTop: 1.0,
  bulletListPaddingLeft: 14,
  bulletGap: 0.8,
  bulletFontSize: 9.5,
  bulletLineHeight: 1.3,

  // Body / summary text
  bodyTextFontSize: 10,
  bodyTextLineHeight: 1.3,
  bodyTextMarginTop: 0,

  // Skills — compact
  skillsMarginTop: 1.0,
  skillsItemFontSize: 9.5,
  skillsItemLineHeight: 1.3,
  skillsItemMarginBottom: 0.8,

  // Achievements
  achievementsListMarginTop: 1.0,
  achievementsPaddingLeft: 14,
  achievementsItemFontSize: 9.5,
  achievementsItemLineHeight: 1.3,
  achievementsItemMarginBottom: 0.8,

  // Certifications
  certificationsMarginTop: 0,
  certificationsGap: 5,
  certificationsColumnGap: 16,
  certificationsItemFontSize: 9.5,
  certificationsItemLineHeight: 1.3,

  // Languages
  languagesMarginTop: 0,
  languagesGap: 4,
  languagesItemFontSize: 9.5,
  languagesItemLineHeight: 1.3,
};

const TEMPLATE_LAYOUTS: Record<TemplateId, ResumeLayout> = {
  ats: { ...BASE_LAYOUT },
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

/** Rendered size (pt) of a contact-row icon. */
export function getContactIconSize(L: ResumeLayout): number {
  return L.contactFontSize * L.contactIconScale;
}

/** Height (pt) of one line of the contact row — the taller of text and icon. */
export function getContactLineHeight(L: ResumeLayout): number {
  return Math.max(L.contactFontSize * L.contactLineHeight, getContactIconSize(L));
}

/** Certifications use two columns, except a lone item which spans the full width. */
export function getCertificationColumns(count: number): number {
  return count > 1 ? 2 : 1;
}

/** Split a list into rows of `size` items (used for multi-column sections). */
export function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

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
