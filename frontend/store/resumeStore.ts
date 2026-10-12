"use client";

import { create } from "zustand";
import { Resume, ResumeAppearance } from "@/types/resume";
import { getAppearance } from "@/lib/resumeAppearance";
import { mockResume } from "@/mocks/mockResume";
import { LAYOUTS, getLayoutSections, type LayoutId } from "@/config/layouts";

export type BuilderSection =
  | "Profile"
  | "Experience"
  | "Education"
  | "Projects"
  | "Research"
  | "Publications"
  | "Skills"
  | "Achievements"
  | "Certifications"
  | "Languages";

interface ResumeStore {
  resume: Resume;

  selectedSection: BuilderSection;

  setResume: (resume: Resume) => void;

  setSelectedSection: (section: BuilderSection) => void;

  setTemplate: (template: Resume["template"]) => void;
  setLayout: (layout: Resume["layout"]) => void;
  setSectionOrder: (sectionOrder: string[]) => void;
  /** Merge into the current appearance; null restores the defaults. */
  setAppearance: (patch: Partial<ResumeAppearance> | null) => void;

  resetResume: () => void;
}

export const useResumeStore = create<ResumeStore>((set) => ({
  resume: mockResume,

  selectedSection: "Profile",

  setResume: (resume) =>
    set({
      resume,
    }),

  setSelectedSection: (selectedSection) =>
    set({
      selectedSection,
    }),

  setTemplate: (template) =>
    set((state) => ({
      resume: {
        ...state.resume,
        template,
        // Also set the layout to match (applies the preset section order)
        layout: template,
        sectionOrder: [...getLayoutSections(template as LayoutId)],
      },
    })),

  setLayout: (layout) =>
    set((state) => ({
      resume: {
        ...state.resume,
        layout,
        // When a preset layout is selected (not custom), update sectionOrder
        sectionOrder:
          layout !== "custom"
            ? [...getLayoutSections(layout as LayoutId)]
            : state.resume.sectionOrder,
      },
    })),

  setSectionOrder: (sectionOrder) =>
    set((state) => ({
      resume: {
        ...state.resume,
        sectionOrder,
        // Auto-set layout to "custom" when manually reordering
        layout: "custom",
      },
    })),

  setAppearance: (patch) =>
    set((state) => {
      if (patch === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { appearance: _removed, ...rest } = state.resume;
        return { resume: rest };
      }
      return {
        resume: {
          ...state.resume,
          appearance: { ...getAppearance(state.resume), ...patch },
        },
      };
    }),

  resetResume: () =>
    set({
      resume: structuredClone(mockResume),
    }),
}));