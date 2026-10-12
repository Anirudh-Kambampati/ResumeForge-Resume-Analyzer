"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw, Type } from "lucide-react";
import { useResumeStore } from "@/store/resumeStore";
import { getAppearance, isDefaultAppearance, DEFAULT_DARKNESS } from "@/lib/resumeAppearance";
import { RESUME_FONTS } from "@/lib/resumeFonts";
import ResumeFontFaces from "./preview/ResumeFontFaces";
import FontPicker from "./FontPicker";

const FONT_ROLES = [
  { key: "headingFont", label: "Heading", hint: "Name, section titles" },
  { key: "subheadingFont", label: "Subheading", hint: "Roles, companies, dates" },
  { key: "bodyFont", label: "Body", hint: "Bullets, summary, skills" },
] as const;

export default function AppearancePanel() {
  const resume = useResumeStore((s) => s.resume);
  const setAppearance = useResumeStore((s) => s.setAppearance);
  const [open, setOpen] = useState(true);

  const appearance = getAppearance(resume);
  const isDefault = isDefaultAppearance(appearance);
  const darknessLabel = appearance.darkness === DEFAULT_DARKNESS ? "Default" : `${appearance.darkness}`;
  const fontSummary = [...new Set(FONT_ROLES.map(({ key }) => RESUME_FONTS[appearance[key]].name))].join(" · ");

  return (
    <div className="overflow-visible rounded-lg border border-white/10 bg-white/[0.03]">
      {/* Loads the font files so each option renders in its own face */}
      <ResumeFontFaces />

      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-on-accent">
            <Type size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-zinc-100">Appearance</span>
            <span className="block truncate text-[10px] text-zinc-500">
              {open ? "Fonts and text darkness" : fontSummary}
            </span>
          </span>
          <ChevronDown size={13} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={() => setAppearance(null)}
            title="Restore default fonts and darkness"
            aria-label="Reset appearance"
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-2.5 pb-3 pt-2.5">
          {FONT_ROLES.map(({ key, label, hint }) => (
            <FontPicker
              key={key}
              label={label}
              hint={hint}
              value={appearance[key]}
              onChange={(font) => setAppearance({ [key]: font })}
            />
          ))}

          <label className="block">
            <span className="mb-1 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold text-zinc-300">Text darkness</span>
              <span className="text-[10px] tabular-nums text-zinc-500">{darknessLabel}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={appearance.darkness}
              onChange={(e) => setAppearance({ darkness: Number(e.target.value) })}
              onDoubleClick={() => setAppearance({ darkness: DEFAULT_DARKNESS })}
              aria-valuetext={darknessLabel}
              title="Double-click to reset"
              className="w-full accent-blue-600"
            />
            <span className="flex justify-between text-[10px] text-zinc-500">
              <span>Lighter</span>
              <span>Darker</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
