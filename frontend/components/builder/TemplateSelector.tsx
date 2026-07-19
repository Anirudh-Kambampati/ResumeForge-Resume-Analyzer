"use client";

import { useResumeStore } from "@/store/resumeStore";
import { type TemplateId } from "@/config/templates";

const OPTIONS: { id: TemplateId; label: string }[] = [
  { id: "ats", label: "ATS" },
  { id: "faang", label: "FAANG" },
  { id: "research", label: "Research" },
];

export default function TemplateSelector() {
  const current = useResumeStore((s) => s.resume.template);
  const setTemplate = useResumeStore((s) => s.setTemplate);

  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {OPTIONS.map(({ id, label }) => {
        const isActive = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTemplate(id)}
            className={`
              flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold
              transition-all duration-150
              ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
              }
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
