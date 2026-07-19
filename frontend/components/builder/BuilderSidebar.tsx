"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { RotateCcw, LayoutDashboard, FileText } from "lucide-react";
import { useResumeStore, type BuilderSection } from "@/store/resumeStore";
import TemplateSelector from "./TemplateSelector";
import { TEMPLATES, type TemplateId } from "@/config/templates";

// @dnd-kit — client-side only to avoid hydration mismatches
const SectionManager = dynamic(() => import("./SectionManager"), {
  ssr: false,
  loading: () => <div className="py-2" />,
});

type Props = {
  selectedSection: BuilderSection;
  setSelectedSection: (section: BuilderSection) => void;
};

export default function BuilderSidebar({
  selectedSection,
  setSelectedSection,
}: Props) {
  const resume = useResumeStore((s) => s.resume);
  const setLayout = useResumeStore((s) => s.setLayout);

  const isCustom = resume.layout === "custom";
  const templateName = TEMPLATES[resume.template as TemplateId]?.name ?? "ATS";

  return (
    <aside className="flex h-full w-60 flex-col border-r border-white/[0.06] bg-[#09090B]">

      {/* Logo */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-[18px]">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-white transition-colors hover:text-blue-400"
        >
          ResumeForge
        </Link>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">

        {/* ============================
            Template selector
        ============================ */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Template
          </h3>
          <TemplateSelector />
        </div>

        {/* ============================
            Section outline
        ============================ */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <FileText size={10} className="text-zinc-600" />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Outline
            </h3>
          </div>

          <SectionManager
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
          />
        </div>

        {/* ============================
            Custom layout indicator + restore
        ============================ */}
        {isCustom && (
          <div className="mt-auto pt-3">
            <div className="rounded-lg border border-amber-500/8 bg-amber-500/[0.02] px-3 py-2">
              <div className="flex items-center gap-2">
                <LayoutDashboard size={11} className="text-amber-400/50" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/50">
                  Custom Layout
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLayout(resume.template)}
                className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-amber-400/40 transition-colors hover:text-amber-300"
              >
                <RotateCcw size={9} />
                Restore {templateName} Layout
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>
    </aside>
  );
}
