// ============================================================
// Layout Definitions
// Each layout defines a section ordering (render order).
// Changing layout changes which sections appear in which order.
// Layouts NEVER affect visual appearance — templates handle that.
// ============================================================

export type LayoutId = "ats" | "faang" | "research" | "custom";

export interface LayoutDefinition {
  id: LayoutId;
  name: string;
  description: string;
  sections: string[];
}

export const LAYOUTS: Record<LayoutId, LayoutDefinition> = {
  ats: {
    id: "ats",
    name: "ATS",
    description: "Standard ATS-friendly ordering with About Me and Summary at the top.",
    sections: [
      "Experience",
      "Projects",
      "Education",
      "Skills",
      "Certifications",
      "Achievements",
      "Languages",
    ],
  },
  faang: {
    id: "faang",
    name: "FAANG",
    description: "Optimized for software engineering with skills and projects before education.",
    sections: [
      "Experience",
      "Projects",
      "Skills",
      "Education",
      "Certifications",
      "Achievements",
      "Languages",
    ],
  },
  research: {
    id: "research",
    name: "Research",
    description: "Academic ordering with Research and Publications after the introduction.",
    sections: [
      "Research",
      "Publications",
      "Projects",
      "Education",
      "Skills",
      "Certifications",
      "Achievements",
      "Languages",
    ],
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "Manually arranged section order — set automatically when you reorder.",
    sections: [],
  },
};

export function getLayoutSections(layoutId: LayoutId): string[] {
  return LAYOUTS[layoutId]?.sections ?? LAYOUTS.ats.sections;
}
