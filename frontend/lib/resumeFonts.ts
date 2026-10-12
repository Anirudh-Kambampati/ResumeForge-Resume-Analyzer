// ============================================================
// Resume fonts — single registry for both renderers
//
// The HTML preview (via @font-face) and the PDF (via react-pdf
// Font.register) load the SAME files from /public/fonts, so the
// preview and the exported document always use identical glyphs.
//
// widthRatio is the font's average character width relative to
// Inter (measured with fontkit over sample resume text). The Auto
// Fit engine scales its line-wrap estimate by it.
// ============================================================

export type ResumeFontId =
  | "inter"
  | "roboto"
  | "ibm-plex-sans"
  | "source-sans-3"
  | "source-serif-4"
  | "lora"
  | "eb-garamond";

export interface ResumeFontFile {
  src: string;
  fontWeight: 400 | 500 | 600 | 700;
  fontStyle: "normal" | "italic";
}

export interface ResumeFontDef {
  id: ResumeFontId;
  name: string;
  category: "sans" | "serif";
  widthRatio: number;
  files: ResumeFontFile[];
}

/** Fonts downloaded from Google Fonts as static TTFs: 400–700 plus 400 italic. */
function googleFont(id: ResumeFontId, name: string, category: "sans" | "serif", widthRatio: number): ResumeFontDef {
  const file = (fontWeight: ResumeFontFile["fontWeight"], fontStyle: ResumeFontFile["fontStyle"] = "normal"): ResumeFontFile => ({
    src: `/fonts/resume/${id}/${id}-${fontWeight}${fontStyle === "italic" ? "-italic" : ""}.ttf`,
    fontWeight,
    fontStyle,
  });
  return {
    id,
    name,
    category,
    widthRatio,
    files: [file(400), file(400, "italic"), file(500), file(600), file(700)],
  };
}

export const RESUME_FONTS: Record<ResumeFontId, ResumeFontDef> = {
  inter: {
    id: "inter",
    name: "Inter",
    category: "sans",
    widthRatio: 1,
    files: [
      { src: "/fonts/inter/Inter-Regular.ttf", fontWeight: 400, fontStyle: "normal" },
      { src: "/fonts/inter/Inter-Italic.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "/fonts/inter/Inter-Medium.ttf", fontWeight: 500, fontStyle: "normal" },
      { src: "/fonts/inter/Inter-MediumItalic.ttf", fontWeight: 500, fontStyle: "italic" },
      { src: "/fonts/inter/Inter-SemiBold.ttf", fontWeight: 600, fontStyle: "normal" },
      { src: "/fonts/inter/Inter-Bold.ttf", fontWeight: 700, fontStyle: "normal" },
    ],
  },
  roboto: googleFont("roboto", "Roboto", "sans", 0.94),
  "ibm-plex-sans": googleFont("ibm-plex-sans", "IBM Plex Sans", "sans", 0.95),
  "source-sans-3": googleFont("source-sans-3", "Source Sans 3", "sans", 0.88),
  "source-serif-4": googleFont("source-serif-4", "Source Serif 4", "serif", 1.0),
  lora: googleFont("lora", "Lora", "serif", 0.99),
  "eb-garamond": googleFont("eb-garamond", "EB Garamond", "serif", 0.81),
};

export const RESUME_FONT_LIST: ResumeFontDef[] = Object.values(RESUME_FONTS);

export function isResumeFontId(value: unknown): value is ResumeFontId {
  return typeof value === "string" && value in RESUME_FONTS;
}

/**
 * Family name used by both renderers. Prefixed so a locally
 * installed copy of the same font can never stand in for ours.
 */
export function resumeFontFamily(id: ResumeFontId): string {
  return `RF ${RESUME_FONTS[id].name}`;
}

/** CSS font-family value for the HTML preview, with a generic fallback. */
export function resumeFontStack(id: ResumeFontId): string {
  return `"${resumeFontFamily(id)}", ${RESUME_FONTS[id].category === "serif" ? "serif" : "sans-serif"}`;
}

/** @font-face rules for every resume font (browsers only download the ones in use). */
export function buildResumeFontFaceCss(): string {
  return RESUME_FONT_LIST.flatMap((font) =>
    font.files.map(
      (f) =>
        `@font-face{font-family:"${resumeFontFamily(font.id)}";src:url("${f.src}") format("truetype");` +
        `font-weight:${f.fontWeight};font-style:${f.fontStyle};font-display:block;}`
    )
  ).join("\n");
}
