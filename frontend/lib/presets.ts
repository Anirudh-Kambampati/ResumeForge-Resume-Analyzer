export const PRESETS = [
  "ATS",
  "Modern",
  "FAANG",
  "Fresher",
  "Research",
  "Creative",
  "Executive",
] as const;

export type ResumePreset = (typeof PRESETS)[number];