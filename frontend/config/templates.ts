// ============================================================
// Template Definitions
// Each template defines visual appearance characteristics.
// Templates NEVER affect section order — layouts handle that.
// Templates NEVER affect resume data.
// ============================================================

export type TemplateId = "ats" | "research";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  icon: string;
}

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  ats: {
    id: "ats",
    name: "ATS",
    description: "Single-column, black-and-white, maximum ATS compatibility. Inspired by classic Jake's Resume.",
    icon: "📄",
  },
  research: {
    id: "research",
    name: "Research",
    description: "Academic styling with publication formatting and scholarly typography.",
    icon: "🔬",
  },
};

// ============================================================
// Template Visual Styles
// Each template overrides specific visual properties applied on
// top of the density-based ResumeLayout. These are the visual
// differences between templates — everything else comes from
// the layout config.
// ============================================================

export interface TemplateStyles {
  /** Header / name styling */
  nameFontWeight: 400 | 500 | 600 | 700 | 800;
  nameSizeMultiplier: number; // applied on top of L.nameFontSize

  /** Title styling */
  titleFontWeight: 400 | 500 | 600 | 700;
  titleLetterSpacing: number;

  /** Section heading styling */
  sectionHeaderFontWeight: 400 | 500 | 600 | 700;
  sectionHeaderLetterSpacing: number;
  sectionHeaderBorderWidth: number; // overrides L.sectionHeaderBorderWidth (0 = no border)
  sectionHeaderTransform: "uppercase" | "none";
  sectionHeaderBorderStyle: "solid" | "double" | "none";

  /** Entry title styling */
  entryTitleFontWeight: 400 | 500 | 600 | 700;
  entrySubtitleFontWeight: 400 | 500 | 600 | 700;
}

export const TEMPLATE_STYLES: Record<TemplateId, TemplateStyles> = {
  // ============================================================
  // ATS — Jake's Resume-inspired (classic single-column)
  // - Title Case headings, thin dividers, compact spacing
  // - No decorative elements — plain, scannable, ATS-friendly
  // ============================================================
  ats: {
    nameFontWeight: 700,
    nameSizeMultiplier: 1.0,
    titleFontWeight: 600,
    titleLetterSpacing: 0.0,
    sectionHeaderFontWeight: 700,
    sectionHeaderLetterSpacing: 0.0,
    sectionHeaderBorderWidth: 0.5,
    sectionHeaderTransform: "none",
    sectionHeaderBorderStyle: "solid",
    entryTitleFontWeight: 700,
    entrySubtitleFontWeight: 400,
  },

  // ============================================================
  // Research — Academic styling
  // - Serif-style hierarchy, muted section headers,
  //   publication-friendly spacing
  // ============================================================
  research: {
    nameFontWeight: 700,
    nameSizeMultiplier: 1.0,
    titleFontWeight: 500,
    titleLetterSpacing: 1.5,
    sectionHeaderFontWeight: 600,
    sectionHeaderLetterSpacing: 1.0,
    sectionHeaderBorderWidth: 0.75,
    sectionHeaderTransform: "uppercase",
    sectionHeaderBorderStyle: "double",
    entryTitleFontWeight: 600,
    entrySubtitleFontWeight: 500,
  },
};

export function getTemplateStyles(templateId?: TemplateId | null): TemplateStyles {
  return (templateId ? TEMPLATE_STYLES[templateId] : undefined) ?? TEMPLATE_STYLES.ats;
}
