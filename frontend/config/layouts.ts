// ============================================================
// Layout Definitions
// Each layout defines a section ordering (render order).
// Changing layout changes which sections appear in which order.
// Layouts NEVER affect visual appearance — templates handle that.
// ============================================================

export type LayoutId = "ats" | "research" | "custom";

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
    description: "Standard Jake's Resume ordering: Experience, Projects, Education, Skills.",
    sections: [
      "Experience",
      "Projects",
      "Education",
      "Research",
      "Skills",
      "Certifications",
      "Achievements",
      "Languages",
      "Publications",
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
