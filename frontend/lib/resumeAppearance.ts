import { Resume, ResumeAppearance } from "@/types/resume";
import { isResumeFontId, RESUME_FONTS } from "@/lib/resumeFonts";

// ============================================================
// Resume appearance — user-chosen fonts and text darkness
//
// Font roles:
//   heading    — name, section headings
//   subheading — titles line, entry titles, subtitles, dates
//   body       — contact row, summary, bullets, skills,
//                achievements, certifications, languages
//
// Darkness runs 0–100. 50 is the original palette; 0 is the
// lightest still-readable palette, 100 is near-black.
// ============================================================

export const DEFAULT_DARKNESS = 50;

export const DEFAULT_APPEARANCE: ResumeAppearance = {
  headingFont: "inter",
  subheadingFont: "inter",
  bodyFont: "inter",
  darkness: DEFAULT_DARKNESS,
};

/** The resume's appearance with defaults filled in and bad values discarded. */
export function getAppearance(resume: Pick<Resume, "appearance">): ResumeAppearance {
  const a = resume.appearance;
  if (!a) return DEFAULT_APPEARANCE;
  const darkness = Number(a.darkness);
  return {
    headingFont: isResumeFontId(a.headingFont) ? a.headingFont : DEFAULT_APPEARANCE.headingFont,
    subheadingFont: isResumeFontId(a.subheadingFont) ? a.subheadingFont : DEFAULT_APPEARANCE.subheadingFont,
    bodyFont: isResumeFontId(a.bodyFont) ? a.bodyFont : DEFAULT_APPEARANCE.bodyFont,
    darkness: Number.isFinite(darkness) ? Math.min(100, Math.max(0, darkness)) : DEFAULT_DARKNESS,
  };
}

export function isDefaultAppearance(a: ResumeAppearance): boolean {
  return (
    a.headingFont === DEFAULT_APPEARANCE.headingFont &&
    a.subheadingFont === DEFAULT_APPEARANCE.subheadingFont &&
    a.bodyFont === DEFAULT_APPEARANCE.bodyFont &&
    a.darkness === DEFAULT_APPEARANCE.darkness
  );
}

/** Average character width of each role's font, relative to Inter. */
export function getFontWidthRatios(resume: Pick<Resume, "appearance">) {
  const a = getAppearance(resume);
  return {
    heading: RESUME_FONTS[a.headingFont].widthRatio,
    subheading: RESUME_FONTS[a.subheadingFont].widthRatio,
    body: RESUME_FONTS[a.bodyFont].widthRatio,
  };
}

export type FontWidthRatios = ReturnType<typeof getFontWidthRatios>;

// ============================================================
// Palette
// ============================================================

export interface ResumePalette {
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  divider: string;
}

type Anchor = Record<keyof ResumePalette, string>;

// Lightest end keeps every text colour at 4.5:1 contrast or better on white
const LIGHT: Anchor = {
  textPrimary: "#3d3d3d",
  textBody: "#575757",
  textSecondary: "#666666",
  textTertiary: "#757575",
  textMuted: "#b0b0b0",
  divider: "#575757",
};

// The original palette (darkness 50)
const DEFAULT: Anchor = {
  textPrimary: "#171717",
  textBody: "#404040",
  textSecondary: "#525252",
  textTertiary: "#737373",
  textMuted: "#a3a3a3",
  divider: "#000000",
};

const DARK: Anchor = {
  textPrimary: "#000000",
  textBody: "#141414",
  textSecondary: "#262626",
  textTertiary: "#333333",
  textMuted: "#595959",
  divider: "#000000",
};

function mix(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function getPalette(darkness: number): ResumePalette {
  const [from, to, t] =
    darkness <= DEFAULT_DARKNESS
      ? [LIGHT, DEFAULT, darkness / DEFAULT_DARKNESS]
      : [DEFAULT, DARK, (darkness - DEFAULT_DARKNESS) / (100 - DEFAULT_DARKNESS)];
  const keys = Object.keys(DEFAULT) as (keyof ResumePalette)[];
  return Object.fromEntries(keys.map((k) => [k, mix(from[k], to[k], t)])) as unknown as ResumePalette;
}
