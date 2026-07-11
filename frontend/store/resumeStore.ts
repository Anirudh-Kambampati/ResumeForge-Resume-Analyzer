"use client";

import { create } from "zustand";
import { Resume } from "@/types/resume";
import { mockResume } from "@/mocks/mockResume";

export type BuilderSection =
  | "Profile"
  | "Summary"
  | "Experience"
  | "Education"
  | "Projects"
  | "Skills"
  | "Achievements"
  | "Certifications"
  | "Languages";

interface ResumeStore {
  resume: Resume;

  selectedSection: BuilderSection;

  setResume: (resume: Resume) => void;

  setSelectedSection: (section: BuilderSection) => void;

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

  resetResume: () =>
    set({
      resume: structuredClone(mockResume),
    }),
}));