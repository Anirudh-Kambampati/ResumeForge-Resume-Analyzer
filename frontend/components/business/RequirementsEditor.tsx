"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { RequirementListKey, ScreeningQueue } from "@/types/screening";
import { useScreeningStore } from "@/store/screeningStore";

const LISTS: { key: RequirementListKey; label: string; hint: string; tone: string }[] = [
  { key: "required_skills", label: "Required skills", hint: "25 pts", tone: "border-line bg-marker font-bold text-[#1f1b16]" },
  { key: "preferred_skills", label: "Preferred skills", hint: "10 pts", tone: "border-line bg-panel font-semibold text-white" },
  { key: "domain_keywords", label: "Domain terms", hint: "15 pts", tone: "border-zinc-700 bg-white/[0.04] text-zinc-300" },
  { key: "responsibilities", label: "Responsibilities", hint: "10 pts", tone: "border-zinc-700 bg-white/[0.04] text-zinc-300" },
];

function ChipList({
  queueId,
  list,
  items,
  label,
  hint,
  tone,
}: {
  queueId: string;
  list: RequirementListKey;
  items: string[];
  label: string;
  hint: string;
  tone: string;
}) {
  const addRequirement = useScreeningStore((s) => s.addRequirement);
  const removeRequirement = useScreeningStore((s) => s.removeRequirement);
  const [draft, setDraft] = useState("");

  const commit = () => {
    addRequirement(queueId, list, draft);
    setDraft("");
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</h4>
        <span className="text-[10px] text-zinc-600">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`group inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${tone}`}
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              onClick={() => removeRequirement(queueId, list, item)}
              className="shrink-0 opacity-60 transition hover:opacity-100"
              aria-label={`Remove ${item}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          className="inline-flex items-center rounded-lg border border-dashed border-white/10 focus-within:border-blue-500/50"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add"
            className="w-20 bg-transparent px-2 py-1 text-xs text-white outline-none placeholder:text-zinc-600 focus:w-32 transition-all"
          />
          <button type="submit" className="px-1.5 text-zinc-500 hover:text-white" aria-label={`Add to ${label}`}>
            <Plus size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Editable view of the requirements every resume in the queue is scored against. */
export default function RequirementsEditor({ queue }: { queue: ScreeningQueue }) {
  const setTargetTitle = useScreeningStore((s) => s.setTargetTitle);
  const requirements = queue.requirements;
  if (!requirements) return null;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Target title</h4>
          <span className="text-[10px] text-zinc-600">15 pts</span>
        </div>
        <input
          value={requirements.target_title}
          onChange={(e) => setTargetTitle(queue.id, e.target.value)}
          className="w-full rounded-xl border-2 border-line bg-panel px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-marker/70"
        />
      </div>
      {LISTS.map(({ key, label, hint, tone }) => (
        <ChipList
          key={key}
          queueId={queue.id}
          list={key}
          items={requirements[key]}
          label={label}
          hint={hint}
          tone={tone}
        />
      ))}
      <p className="text-[11px] leading-relaxed text-zinc-500">
        The remaining 25 points come from hands-on evidence (required skills shown in experience or
        projects) and overall keyword coverage. Edits apply to every resume in this queue.
      </p>
    </div>
  );
}
