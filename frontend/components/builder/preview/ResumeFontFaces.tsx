import { buildResumeFontFaceCss } from "@/lib/resumeFonts";

// Same TTF files the PDF renderer registers, so preview and export match
const FONT_FACE_CSS = buildResumeFontFaceCss();

/** @font-face rules for the resume fonts. React hoists this into <head> once, however many render it. */
export default function ResumeFontFaces() {
  return (
    <style href="rf-resume-fonts" precedence="default">
      {FONT_FACE_CSS}
    </style>
  );
}
