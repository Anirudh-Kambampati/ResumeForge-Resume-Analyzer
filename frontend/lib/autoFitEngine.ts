// ============================================================
// Auto Fit Layout Engine
//
// Purpose: Maximize content on a single page by progressively
// tightening spacing before allowing a second page.
//
// Pipeline (steps 0-7, cumulative):
//   0: Base layout (no changes)
//   1. Reduce page margin
//   2. Reduce header bottom spacing
//   3. Reduce spacing between sections
//   4. Reduce spacing between bullets
//   5. Reduce line heights
//   6. Reduce entry/item gaps
//   7. Slightly reduce font sizes
//
// Both Preview (HTML) and PDF (react-pdf) consume the same
// engine so they produce identical optimized layouts.
// ============================================================

import { Resume } from "@/types/resume";
import {
  type ResumeLayout,
  getResumeLayout,
  getContactIconSize,
  getContactLineHeight,
  chunkRows,
  getCertificationColumns,
  BASE_LAYOUT,
} from "@/lib/resumeLayout";
import { hasSectionData } from "@/config/sections";
import { getTemplateStyles } from "@/config/templates";
import { buildATSContactLine } from "@/lib/contactLinks";

// ============================================================
// Types
// ============================================================

export type CompressLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ============================================================
// A4 dimensions (points)
// ============================================================

export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

// ============================================================
// Compress level adjustments
//
// Each level is cumulative: level N includes all adjustments
// from levels 0 through N. The applyCompressLevel function
// merges them in ascending order.
//
// Note: text wrapping (level 6) is implemented at the CSS /
// react-pdf style level, not as layout value changes.
// ============================================================

type LayoutAdjustments = Partial<ResumeLayout>;

const COMPRESS_STEPS: Record<CompressLevel, LayoutAdjustments> = {
  // Level 0 — Base layout, no changes
  0: {},

  // Level 1 — Reduce page margin (header sits higher)
  1: {
    pagePadding: 28,
  },

  // Level 2 — Reduce header spacing (~65% of base, never back to cramped)
  2: {
    nameMarginBottom: 1.5,
    titleMarginTop: 1.0,
    titleMarginBottom: 3.0,
    headerPaddingBottom: 3.0,
    contactRowGap: 1.5,
    contactItemGap: 11,
  },

  // Level 3 — Reduce spacing between sections
  3: {
    sectionMarginTop: 3.5,
    sectionHeaderMarginBottom: 3.5,
    entryGap: 3.5,
  },

  // Level 4 — Reduce spacing between bullets
  4: {
    bulletGap: 0.3,
    bulletListMarginTop: 0.5,
    skillsItemMarginBottom: 0.3,
    achievementsItemMarginBottom: 0.3,
    certificationsGap: 4,
    languagesGap: 3,
  },

  // Level 5 — Reduce line heights (tighter text)
  5: {
    bodyTextLineHeight: 1.25,
    bulletLineHeight: 1.25,
    skillsItemLineHeight: 1.2,
    nameLineHeight: 1.0,
    entryTitleLineHeight: 1.1,
    certificationsItemLineHeight: 1.2,
    languagesItemLineHeight: 1.2,
    achievementsItemLineHeight: 1.25,
  },

  // Level 6 — Further tighten entry spacing + section gaps + slight font reductions
  // (Word-wrap optimization is a CSS/style hint, not a layout value)
  6: {
    entryGap: 2.5,
    sectionMarginTop: 2.5,
    sectionHeaderMarginBottom: 2.5,
    bulletListMarginTop: 0,
    skillsMarginTop: 0.5,
    bodyTextFontSize: 9.75,
    bulletFontSize: 9.25,
    skillsItemFontSize: 9.25,
    entrySubtitleFontSize: 9.75,
    entryMetaFontSize: 8.75,
  },

  // Level 7 — Further reduce font sizes (last resort)
  7: {
    bodyTextFontSize: 9.5,
    bulletFontSize: 9.0,
    skillsItemFontSize: 9.0,
    contactFontSize: 8.25,
    sectionHeaderFontSize: 9.5,
    entrySubtitleFontSize: 9.5,
    entryMetaFontSize: 8.5,
    certificationsItemFontSize: 9.0,
    languagesItemFontSize: 9.0,
    achievementsItemFontSize: 9.0,
    titleFontSize: 10,
  },
};

// ============================================================
// applyCompressLevel — merge adjustments from levels 0..level
// ============================================================

export function applyCompressLevel(
  base: ResumeLayout,
  level: CompressLevel
): ResumeLayout {
  let result = { ...base };

  for (let l = 0; l <= level; l++) {
    const adjustments = COMPRESS_STEPS[l as CompressLevel];
    result = { ...result, ...adjustments };
  }

  return result;
}

// ============================================================
// Height estimation
//
// Estimates the total vertical space the resume content will
// occupy when rendered with a given layout. Used to determine
// the minimum compress level that fits on one A4 page.
//
// The estimation models the DOM / react-pdf rendering:
//   - Text wraps based on available line width
//   - Each element contributes its font-size * line-height
//   - Margins and gaps stack
//
// NOTE: This is an approximation. Actual rendering may differ
// slightly due to font metrics, but the relative ordering of
// compress levels is preserved.
// ============================================================

/** Estimate the number of rendered lines for a block of text. */
function estimateLines(
  text: string,
  fontSizePt: number,
  availableWidthPt: number
): number {
  if (!text.trim()) return 0;

  // Approximate character width: for Inter at 9-11pt, ~0.52 * fontSize
  const avgCharWidth = fontSizePt * 0.52;
  const charsPerLine = Math.max(20, Math.floor(availableWidthPt / avgCharWidth));

  const words = text.split(/\s+/);
  let lines = 0;
  let currentLineLen = 0;

  for (const word of words) {
    const wordLen = word.length + 1; // +1 for space
    if (currentLineLen + wordLen > charsPerLine) {
      lines++;
      currentLineLen = wordLen;
    } else {
      currentLineLen += wordLen;
    }
  }
  if (currentLineLen > 0) lines++;

  return Math.max(1, lines);
}

/**
 * Estimate how many lines the header contact row wraps onto.
 * Items are packed greedily: icon + gap + text, separated by contactItemGap.
 */
function estimateContactRows(
  resume: Resume,
  L: ResumeLayout,
  availWidthPt: number
): number {
  const entries = buildATSContactLine(resume.profile || {});
  if (entries.length === 0) return 0;

  // Contact values (emails, URLs) are denser than prose — use a wider char estimate
  const avgCharWidth = L.contactFontSize * 0.55;
  const iconWidth = getContactIconSize(L) + L.contactIconGap;

  let rows = 1;
  let lineWidth = 0;
  for (const entry of entries) {
    const itemWidth = iconWidth + entry.display.length * avgCharWidth;
    const needed = lineWidth === 0 ? itemWidth : lineWidth + L.contactItemGap + itemWidth;
    if (needed > availWidthPt && lineWidth > 0) {
      rows++;
      lineWidth = itemWidth;
    } else {
      lineWidth = needed;
    }
  }
  return rows;
}

/** Estimate the height of a single line of text. */
function textLineHeight(fontSizePt: number, lineHeight: number): number {
  return fontSizePt * lineHeight;
}

/** Available content width given page padding. */
function contentWidthPt(pagePadding: number): number {
  return A4_WIDTH_PT - 2 * pagePadding;
}

/** Available content height given page padding. */
function contentHeightPt(pagePadding: number): number {
  return A4_HEIGHT_PT - 2 * pagePadding;
}

interface HeightEstimate {
  /** Total estimated height in points. */
  total: number;
  /** Whether the content is estimated to fit on one page. */
  fitsOnePage: boolean;
  /** How much slack (positive) or overflow (negative) in points. */
  slack: number;
}

/**
 * Estimate the total rendered height of the resume with a given layout.
 */
export function estimateResumeHeight(
  resume: Resume,
  layout: ResumeLayout
): HeightEstimate {
  const availWidth = contentWidthPt(layout.pagePadding);
  const availHeight = contentHeightPt(layout.pagePadding);

  let totalHeight = 0;

  // ==========================================================
  // Helper: add margins for a section
  // ==========================================================

  // ==========================================================
  // HEADER
  // ==========================================================

  // Name
  const nameSize = layout.nameFontSize * getTemplateStyles(resume.template).nameSizeMultiplier;
  totalHeight += textLineHeight(nameSize, layout.nameLineHeight);
  totalHeight += layout.nameMarginBottom;

  // Titles (joined with " | ", may wrap)
  const titleLine = (resume.profile?.titles || []).filter(Boolean).join(" | ");
  if (titleLine) {
    const titleLines = estimateLines(titleLine, layout.titleFontSize, availWidth);
    totalHeight += layout.titleMarginTop;
    totalHeight += titleLines * textLineHeight(layout.titleFontSize, layout.titleLineHeight);
    totalHeight += layout.titleMarginBottom;
  }

  // Contact row (icon + text items, centered, wrapping)
  const contactRows = estimateContactRows(resume, layout, availWidth);
  if (contactRows > 0) {
    if (!titleLine) totalHeight += layout.titleMarginTop;
    totalHeight += contactRows * getContactLineHeight(layout);
    totalHeight += (contactRows - 1) * layout.contactRowGap;
  }

  // Gap before the first section (which adds its own sectionMarginTop)
  totalHeight += layout.headerPaddingBottom;

  // ==========================================================
  // SUMMARY
  // ==========================================================
  if (resume.summary?.enabled && resume.summary.text?.trim()) {
    totalHeight += layout.sectionMarginTop; // section wrapper margin
    // Section heading (see estimateSectionHeight)
    totalHeight += textLineHeight(layout.sectionHeaderFontSize, layout.bodyTextLineHeight);
    totalHeight += layout.sectionHeaderPaddingBottom;
    totalHeight += getTemplateStyles(resume.template).sectionHeaderBorderWidth;
    totalHeight += layout.sectionHeaderMarginBottom;

    // Summary text
    const summaryLines = estimateLines(
      resume.summary.text,
      layout.bodyTextFontSize,
      availWidth
    );
    totalHeight += summaryLines * textLineHeight(layout.bodyTextFontSize, layout.bodyTextLineHeight);

    // Bottom margin of section
    totalHeight += 2;
  }

  // ==========================================================
  // RENDERED SECTIONS (from sectionOrder)
  // ==========================================================
  const sectionsToRender = (resume.sectionOrder || []).filter((section) =>
    hasSectionData(resume, section)
  );

  for (const sectionId of sectionsToRender) {
    totalHeight += estimateSectionHeight(resume, sectionId, layout, availWidth);
  }

  // Add a 15pt safety margin to account for estimation inaccuracies
  // (font metric differences, date columns reducing available width, etc.)
  const slack = availHeight - totalHeight - 15;
  const fitsOnePage = slack >= 0;

  return { total: totalHeight, fitsOnePage, slack };
}

/**
 * Estimate the height contributed by a single section.
 */
function estimateSectionHeight(
  resume: Resume,
  sectionId: string,
  L: ResumeLayout,
  availWidth: number
): number {
  let h = 0;

  // Section margin top
  h += L.sectionMarginTop;

  // Section heading — the PDF heading inherits the page line-height
  // (bodyTextLineHeight), and the divider's border adds its own width.
  h += textLineHeight(L.sectionHeaderFontSize, L.bodyTextLineHeight);
  h += L.sectionHeaderPaddingBottom;
  h += getTemplateStyles(resume.template).sectionHeaderBorderWidth;
  h += L.sectionHeaderMarginBottom;

  // ---- Experiences ----
  if (sectionId === "Experience") {
    const items = (resume.experience || []).filter((e) => e.enabled);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0) h += L.entryGap;
      // Role title line
      h += textLineHeight(L.entrySubtitleFontSize, L.bodyTextLineHeight);
      // Company line
      h += textLineHeight(L.entryMetaFontSize, 1.3);
      // Bullets
      h += estimateBulletsHeight(item.bullets || [], L, availWidth);
    }
    return h;
  }

  // ---- Education ----
  if (sectionId === "Education") {
    const items = (resume.education || []).filter((e) => e.enabled);
    for (let i = 0; i < items.length; i++) {
      if (i > 0) h += L.entryGap;
      // Degree + date inline + institution line
      h += textLineHeight(L.entrySubtitleFontSize, L.bodyTextLineHeight);
      h += textLineHeight(L.entryMetaFontSize, 1.3);
    }
    return h;
  }

  // ---- Projects ----
  if (sectionId === "Projects") {
    const items = (resume.projects || []).filter((p) => p.enabled);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0) h += L.entryGap;
      // Title + tech inline
      const titleLines = estimateLines(
        item.title + (item.technologies?.length ? ` | ${item.technologies.join(", ")}` : ""),
        L.entrySubtitleFontSize,
        availWidth
      );
      h += titleLines * textLineHeight(L.entrySubtitleFontSize, L.bodyTextLineHeight);
      // Bullets
      h += estimateBulletsHeight(item.bullets || [], L, availWidth);
    }
    return h;
  }

  // ---- Research ----
  if (sectionId === "Research") {
    const items = (resume.research || []).filter((r: any) => r.enabled);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0) h += L.entryGap;
      // Title
      h += textLineHeight(L.entrySubtitleFontSize, L.bodyTextLineHeight);
      // Institution / advisor
      if (item.institution) {
        h += textLineHeight(L.entryMetaFontSize, 1.3);
      }
      // Bullets
      h += estimateBulletsHeight(item.bullets || [], L, availWidth);
    }
    return h;
  }

  // ---- Publications ----
  if (sectionId === "Publications") {
    const items = (resume.publications || []).filter((p: any) => p.enabled);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0) h += L.entryGap;
      // Title
      h += textLineHeight(L.entrySubtitleFontSize, L.bodyTextLineHeight);
      // Authors
      if (item.authors) {
        h += textLineHeight(L.entryMetaFontSize, 1.3);
      }
      // Venue
      h += textLineHeight(L.entryMetaFontSize, 1.3);
      // Description
      if (item.description) {
        const descLines = estimateLines(item.description, L.bodyTextFontSize, availWidth);
        h += descLines * textLineHeight(L.bodyTextFontSize, L.bodyTextLineHeight);
      }
    }
    return h;
  }

  // ---- Skills ----
  if (sectionId === "Skills") {
    const active = (resume.skills || []).filter(
      (s) => s.title?.trim() && s.items?.length > 0
    );
    h += L.skillsMarginTop;
    for (const skill of active) {
      // "Title: items" inline — estimate as 1-2 lines
      const text = skill.title + ": " + [...new Set(skill.items.filter(Boolean))].join(", ");
      const lines = estimateLines(text, L.skillsItemFontSize, availWidth);
      h += lines * textLineHeight(L.skillsItemFontSize, L.bodyTextLineHeight);
      h += 1.5; // skill title's marginBottom in the PDF row
      h += L.skillsItemMarginBottom;
    }
    return h;
  }

  // ---- Achievements ----
  if (sectionId === "Achievements") {
    const items = (resume.achievements || []).filter(
      (a) => a.enabled && (a.title || a.description)
    );
    h += L.achievementsListMarginTop;
    for (const item of items) {
      const achText = item.title + (item.title && item.description ? " — " : "") + (item.description || "");
      const achLines = estimateLines(achText, L.achievementsItemFontSize, availWidth);
      h += achLines * textLineHeight(L.achievementsItemFontSize, L.achievementsItemLineHeight);
      h += L.achievementsItemMarginBottom;
    }
    return h;
  }

  // ---- Certifications ----
  if (sectionId === "Certifications") {
    // Two columns: each row is as tall as its longer (wrapped) entry
    const items = (resume.certifications || []).filter((c) => c.enabled);
    const columns = getCertificationColumns(items.length);
    const columnWidth = (availWidth - L.certificationsColumnGap * (columns - 1)) / columns;
    for (const row of chunkRows(items, columns)) {
      const lines = Math.max(
        ...row.map((c) =>
          estimateLines(c.title + (c.issuer ? ` \u2014 ${c.issuer}` : ""), L.certificationsItemFontSize, columnWidth)
        )
      );
      h += lines * textLineHeight(L.certificationsItemFontSize, L.certificationsItemLineHeight);
      h += L.certificationsGap * 0.4;
    }
    return h;
  }

  // ---- Languages ----
  if (sectionId === "Languages") {
    const items = (resume.languages || []).filter(
      (l) => l.enabled && (l.name || l.proficiency)
    );
    h += L.languagesMarginTop;
    // Assume 1 line for languages (they wrap in a flex row)
    if (items.length > 0) {
      h += textLineHeight(L.languagesItemFontSize, L.languagesItemLineHeight);
    }
    return h;
  }

  return h;
}

/**
 * Estimate the height of a bullet list.
 */
function estimateBulletsHeight(
  bullets: string[],
  L: ResumeLayout,
  availWidth: number
): number {
  if (!bullets || bullets.length === 0) return 0;

  let h = L.bulletListMarginTop;

  for (const bullet of bullets) {
    if (!bullet.trim()) continue;

    // Bullet marker width offset reduces available text width
    const markerWidth = L.bulletListPaddingLeft * 0.45 + 4; // bullet mark + space
    const bulletAvailWidth = availWidth * 0.92 - markerWidth; // account for flex layout

    const lines = estimateLines(bullet, L.bulletFontSize, bulletAvailWidth);
    h += lines * textLineHeight(L.bulletFontSize, L.bulletLineHeight);
    h += L.bulletGap;
  }

  return h;
}

// ============================================================
// findOptimalLayout — try compress levels until content fits
// ============================================================

export interface AutoFitResult {
  /** The optimal compress level (0-7) that makes content fit. */
  level: CompressLevel;
  /** The optimized layout. */
  layout: ResumeLayout;
  /** Height estimate for the optimized layout. */
  estimate: HeightEstimate;
  /** Whether all levels were tried and content still overflows. */
  stillOverflows: boolean;
}

/**
 * Find the optimal compress level that fits the resume on one page.
 *
 * Starts at level 0 (base layout) and progressively tightens spacing
 * until the estimated height fits within one A4 page. Returns the
 * first level that fits (or the tightest level if even level 7
 * doesn't fit).
 */
export function findOptimalLayout(resume: Resume): AutoFitResult {
  // Use the template-specific base layout so the auto-fit engine
  // estimates height correctly for each template (e.g. Creative's
  // two-column layout with tighter spacing).
  const templateBase = getResumeLayout(resume);

  let best: AutoFitResult = {
    level: 0,
    layout: applyCompressLevel(templateBase, 0),
    estimate: { total: 0, fitsOnePage: false, slack: 0 },
    stillOverflows: true,
  };

  for (let level = 0; level <= 7; level++) {
    const levelTyped = level as CompressLevel;
    const layout = applyCompressLevel(templateBase, levelTyped);
    const estimate = estimateResumeHeight(resume, layout);

    best = {
      level: levelTyped,
      layout,
      estimate,
      stillOverflows: !estimate.fitsOnePage,
    };

    // Stop at the first level that fits
    if (estimate.fitsOnePage) {
      break;
    }
  }

  return best;
}


