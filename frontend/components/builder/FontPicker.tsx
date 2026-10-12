"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { RESUME_FONTS, RESUME_FONT_LIST, resumeFontStack, type ResumeFontId } from "@/lib/resumeFonts";

// Sans first, then serif — the order options appear in and arrow keys walk through
const GROUPS = [
  { label: "Sans serif", fonts: RESUME_FONT_LIST.filter((f) => f.category === "sans") },
  { label: "Serif", fonts: RESUME_FONT_LIST.filter((f) => f.category === "serif") },
];
const ORDER: ResumeFontId[] = GROUPS.flatMap((g) => g.fonts.map((f) => f.id));

type Props = {
  label: string;
  hint: string;
  value: ResumeFontId;
  onChange: (id: ResumeFontId) => void;
};

/**
 * Font dropdown drawn in the page (not a native <select>, whose
 * OS-drawn popup swallows pointer events and loses the custom cursor).
 * Each option is shown in its own typeface.
 */
export default function FontPicker({ label, hint, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ResumeFontId>(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  // Close on any press outside the picker
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option in view while arrowing through the list
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-font="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(value);
    setOpen(true);
  };

  const choose = (font: ResumeFontId) => {
    onChange(font);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    const i = ORDER.indexOf(active);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(ORDER[Math.min(ORDER.length - 1, i + 1)]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(ORDER[Math.max(0, i - 1)]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(ORDER[e.key === "Home" ? 0 : ORDER.length - 1]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-[11px] font-semibold text-zinc-300">
          {label}
        </span>
        <span className="truncate text-[10px] text-zinc-500">{hint}</span>
      </div>

      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`
          flex w-full items-center justify-between gap-2 rounded-md border bg-zinc-900 px-2.5 py-1.5
          text-left text-[13px] text-zinc-100 transition-colors
          ${open ? "border-blue-500" : "border-white/10 hover:border-white/25"}
        `}
      >
        <span id={`${id}-value`} className="truncate" style={{ fontFamily: resumeFontStack(value) }}>
          {RESUME_FONTS[value].name}
        </span>
        <ChevronDown size={13} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="rf-card absolute inset-x-0 z-30 mt-1 max-h-72 overflow-y-auto p-1"
        >
          {GROUPS.map((group) => (
            <li key={group.label} role="presentation">
              <div className="px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {group.label}
              </div>
              <ul role="group" aria-label={group.label}>
                {group.fonts.map((font) => {
                  const selected = font.id === value;
                  return (
                    <li
                      key={font.id}
                      id={`${id}-${font.id}`}
                      role="option"
                      aria-selected={selected}
                      data-font={font.id}
                      data-cursor="hover"
                      onClick={() => choose(font.id)}
                      onPointerMove={() => setActive(font.id)}
                      className={`
                        flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[14px]
                        ${font.id === active ? "bg-white/[0.07]" : ""}
                        ${selected ? "text-zinc-100" : "text-zinc-300"}
                      `}
                    >
                      <span style={{ fontFamily: resumeFontStack(font.id) }}>{font.name}</span>
                      {selected && <Check size={13} className="shrink-0 text-blue-500" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
