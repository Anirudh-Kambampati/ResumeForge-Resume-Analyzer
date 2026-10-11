// ============================================================
// PDF report kit — the app's paper style for @react-pdf
//
// Shared by the business screening report and the individual
// analysis report: fonts, the paper palette, and drawing pieces
// (cards with hard shadows, marker stickers, score stickers,
// keyword chips, meters, coverage rings, bullet lists).
// Import only from modules loaded on demand (react-pdf is large).
// ============================================================

import React from "react";
import { Circle, Font, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

/** Found / not found lists, e.g. required skills. */
export interface Coverage {
  matched: string[];
  missing: string[];
}

// Characters the report fonts don't contain. AI text often uses U+2011
// (non-breaking hyphen), which would otherwise vanish: "end‑to‑end" → "endtoend".
const PDF_CHAR_FIXES: [RegExp, string][] = [
  [/[‐‑‒−]/g, "-"],
  [/[―]/g, "—"],
  [/[   ]/g, " "],
  [/[­​‌‍⁠﻿]/g, ""],
];

export function pdfSafe(text: string): string {
  return PDF_CHAR_FIXES.reduce((t, [pattern, repl]) => t.replace(pattern, repl), text);
}

/**
 * Deep copy with every string made PDF-safe. Only plain objects and arrays
 * are walked; anything else (File, Date, class instances) is kept as is.
 */
export function pdfSafeData<T>(value: T): T {
  if (typeof value === "string") return pdfSafe(value) as T;
  if (Array.isArray(value)) return value.map(pdfSafeData) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pdfSafeData(v)])) as T;
  }
  return value;
}

Font.register({
  family: "Bricolage",
  fonts: [
    { src: "/fonts/report/bricolage-grotesque-latin-400-normal.woff", fontWeight: 400 },
    { src: "/fonts/report/bricolage-grotesque-latin-600-normal.woff", fontWeight: 600 },
    { src: "/fonts/report/bricolage-grotesque-latin-700-normal.woff", fontWeight: 700 },
    { src: "/fonts/report/bricolage-grotesque-latin-800-normal.woff", fontWeight: 800 },
  ],
});
Font.register({
  family: "Instrument",
  fonts: [
    { src: "/fonts/report/instrument-serif-latin-400-normal.woff", fontWeight: 400, fontStyle: "normal" },
    { src: "/fonts/report/instrument-serif-latin-400-italic.woff", fontWeight: 400, fontStyle: "italic" },
  ],
});
Font.register({ family: "Caveat", src: "/fonts/report/caveat-latin-700-normal.woff", fontWeight: 700 });
Font.registerHyphenationCallback((word) => [word]);

// Paper palette from globals.css
export const C = {
  ink: "#1f1b16",
  paper: "#f6f1e7",
  sheet: "#fffdf8",
  marker: "#ffd84d",
  pencil: "#bf3119",
  muted: "#5e554b",
  faint: "#766b5d",
  rule: "#e2d7c3",
  track: "#ede4d3",
  mid: "#cfc4b2",
  green: "#2f6b2f",
  amber: "#9a6200",
  purple: "#6d4fd1",
};

export const A4_HEIGHT = 841.89;

export const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: "Bricolage",
    fontSize: 9,
    lineHeight: 1.4,
    color: C.ink,
  },
  footer: {
    // Anchored from the top: a bottom-anchored fixed View drops its text under an inherited line-height
    position: "absolute",
    top: A4_HEIGHT - 30,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, lineHeight: 1.2, color: C.faint },
  eyebrow: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.muted,
    marginBottom: 6,
  },
  serif: { fontFamily: "Instrument", fontWeight: 400 },
  hand: { fontFamily: "Caveat", fontWeight: 700, color: C.pencil, lineHeight: 1.1 },
  body: { fontSize: 9, lineHeight: 1.45, color: C.ink },
  small: { fontSize: 7.5, color: C.faint },
  row: { flexDirection: "row" },
});

// ------------------------------------------------------------
// Pieces
// ------------------------------------------------------------

export type Tone = "good" | "mid" | "low";
export const toneOf = (score: number): Tone => (score >= 75 ? "good" : score >= 50 ? "mid" : "low");
export const pct = (m: Coverage) => {
  const total = m.matched.length + m.missing.length;
  return total ? m.matched.length / total : null;
};

/** .rf-card: a sheet with an ink outline and a hard offset shadow. `flat` drops the shadow so it can split across pages. */
export function Card({ children, style, flat = false, padding = 11 }: { children: React.ReactNode; style?: Style; flat?: boolean; padding?: number }) {
  if (flat) {
    return (
      <View style={[{ backgroundColor: C.sheet, borderWidth: 1.5, borderColor: C.ink, borderRadius: 12, padding, marginBottom: 11 }, style ?? {}]}>
        {children}
      </View>
    );
  }
  return (
    <View wrap={false} style={[{ position: "relative", marginBottom: 11, marginRight: 3 }, style ?? {}]}>
      <View style={{ position: "absolute", top: 3, left: 3, right: -3, bottom: -3, backgroundColor: C.ink, borderRadius: 12 }} />
      <View style={{ backgroundColor: C.sheet, borderWidth: 1.5, borderColor: C.ink, borderRadius: 12, padding, flexGrow: 1 }}>{children}</View>
    </View>
  );
}

/** .rf-sticker: rounded marker label, slightly tilted. */
export function Sticker({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <View
        style={{
          backgroundColor: C.marker,
          borderWidth: 1.5,
          borderColor: C.ink,
          borderRadius: 99,
          paddingVertical: 3,
          paddingHorizontal: 9,
          transform: "rotate(-2deg)",
        }}
      >
        <Text style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>{children}</Text>
      </View>
    </View>
  );
}

/** .rf-score: round score sticker — marker 75+, paper 50–74, dashed red pencil below. */
export function ScoreSticker({ score, size = 44 }: { score: number; size?: number }) {
  const tone = toneOf(score);
  const rotate = tone === "good" ? -6 : tone === "mid" ? 3 : 6;
  const shadow = tone !== "low";
  const shadowOffset = size > 30 ? 3 : 2;
  return (
    <View style={{ width: size + shadowOffset, height: size + shadowOffset, transform: `rotate(${rotate}deg)` }}>
      {shadow && (
        <View
          style={{
            position: "absolute",
            top: shadowOffset,
            left: shadowOffset,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: C.ink,
          }}
        />
      )}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: size > 30 ? 2 : 1.5,
          borderStyle: tone === "low" ? "dashed" : "solid",
          borderColor: tone === "low" ? C.pencil : C.ink,
          backgroundColor: tone === "good" ? C.marker : C.sheet,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[s.serif, { fontSize: size * 0.48, lineHeight: 1, color: tone === "low" ? C.pencil : C.ink, marginTop: size * 0.06 }]}>
          {score}
        </Text>
      </View>
    </View>
  );
}

/** The sparkle used next to AI text in the table. */
export function Sparkle({ size = 8 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path d="M6 0 L7.3 4.7 L12 6 L7.3 7.3 L6 12 L4.7 7.3 L0 6 L4.7 4.7 Z" fill={C.purple} />
    </Svg>
  );
}

export function Chips({ items, tone, empty, limit = 60 }: { items: string[]; tone: "found" | "missing" | "plain"; empty?: string; limit?: number }) {
  if (items.length === 0) return empty ? <Text style={[s.small, { marginBottom: 2 }]}>{empty}</Text> : null;
  const shown = items.slice(0, limit);
  const chip: Style =
    tone === "found"
      ? { backgroundColor: C.marker, borderWidth: 1, borderColor: C.ink, color: C.ink }
      : tone === "missing"
        ? { borderWidth: 1.2, borderStyle: "dashed", borderColor: C.pencil, color: C.pencil }
        : { borderWidth: 1, borderColor: C.ink, color: C.ink, backgroundColor: C.sheet };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {shown.map((item, i) => (
        <Text key={`${item}-${i}`} style={[{ fontSize: 7.5, fontWeight: 700, borderRadius: 5, paddingVertical: 1.5, paddingHorizontal: 5 }, chip]}>
          {item}
        </Text>
      ))}
      {items.length > shown.length && <Text style={[s.small, { paddingVertical: 2 }]}>+{items.length - shown.length} more</Text>}
    </View>
  );
}

export function Labeled({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={{ marginBottom: last ? 0 : 7 }}>
      <Text style={s.eyebrow}>{label}</Text>
      {children}
    </View>
  );
}

/** Horizontal meter: label, value and a rounded track. */
export function Meter({ label, value, max, valueLabel, fill = C.ink }: { label: string; value: number; max: number; valueLabel?: string; fill?: string }) {
  const width = `${Math.max(0, Math.min(1, value / Math.max(1, max))) * 100}%`;
  return (
    <View style={{ marginBottom: 7 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2.5 }}>
        <Text style={{ fontSize: 8, color: C.muted }}>{label}</Text>
        <Text style={{ fontSize: 8, fontWeight: 700 }}>
          {valueLabel ?? (
            <>
              {value}
              <Text style={{ fontFamily: "Bricolage", color: C.faint, fontWeight: 400 }}>/{max}</Text>
            </>
          )}
        </Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.track }}>
        <View style={{ height: 5, borderRadius: 3, width, backgroundColor: fill }} />
      </View>
    </View>
  );
}

/** Coverage ring: share of a requirement list found in the resume. */
export function Donut({ label, m, size = 62 }: { label: string; m: Coverage; size?: number }) {
  const total = m.matched.length + m.missing.length;
  const share = pct(m);
  const stroke = 7;
  const r = size / 2 - stroke / 2 - 1;
  const cx = size / 2;
  let arc: React.ReactNode = null;
  if (share != null && share >= 0.999) {
    arc = <Circle cx={cx} cy={cx} r={r} stroke={C.ink} strokeWidth={stroke} fill="none" />;
  } else if (share != null && share > 0) {
    const end = -Math.PI / 2 + share * 2 * Math.PI;
    const x = cx + r * Math.cos(end);
    const y = cx + r * Math.sin(end);
    arc = (
      <Path
        d={`M ${cx} ${cx - r} A ${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
        stroke={C.ink}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <View style={{ alignItems: "center", width: size + 16 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cx} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
          {arc}
        </Svg>
        <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Text style={[s.serif, { fontSize: 17, lineHeight: 1, marginTop: 3 }]}>{share == null ? "–" : `${Math.round(share * 100)}%`}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 7.5, fontWeight: 700, marginTop: 4 }}>{label}</Text>
      <Text style={s.small}>{total ? `${m.matched.length} of ${total}` : "none listed"}</Text>
    </View>
  );
}

export function Bullets({ items, color }: { items: string[]; color: string }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 3 }} wrap={false}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 4.5, marginRight: 6 }} />
          <Text style={[s.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Fixed page footer: a label on the left, page numbers on the right. */
export function ReportFooter({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{label}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}
