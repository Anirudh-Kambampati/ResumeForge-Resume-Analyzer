"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Loader2, RotateCcw, Undo2, X } from "lucide-react";
import BuilderPreview from "@/components/builder/BuilderPreview";
import { useResumeStore } from "@/store/resumeStore";
import { locationLabel, locationSection, type ImprovedBullet } from "@/lib/analysis";
import type { BulletApplier } from "@/lib/useBulletApplier";

interface Props {
  open: boolean;
  onClose: () => void;
  applier: BulletApplier;
  bullets: ImprovedBullet[];
}

/**
 * The builder, as a sidebar on the analyzer: the analyzed resume with the
 * applied rewrites, previewed exactly as the builder renders it. Nothing is
 * saved until "Open in builder".
 */
export default function BuilderSidePanel({ open, onClose, applier, bullets }: Props) {
  const router = useRouter();
  const setBuilderResume = useResumeStore((s) => s.setResume);
  const { status, error, resume, states, lastLocation, appliedCount, load } = applier;

  // Opening the panel starts the import of the analyzed file (once; errors retry by hand)
  useEffect(() => {
    if (open && status === "idle") load();
  }, [open, status, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const openInBuilder = () => {
    if (!resume) return;
    let hasSaved = false;
    try {
      hasSaved = !!localStorage.getItem("resumeforge-resume");
    } catch {
      // storage blocked: nothing to overwrite
    }
    if (hasSaved && !window.confirm("This replaces the resume currently in your builder. Continue?")) return;
    try {
      localStorage.setItem("resumeforge-resume", JSON.stringify(resume));
    } catch {
      // the store update below still carries it for this session
    }
    setBuilderResume(resume);
    router.push("/builder");
  };

  const pendingCount = bullets.length - appliedCount - Object.values(states).filter((s) => s.kind === "missing").length;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Close builder preview"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] lg:bg-black/20"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-panel-title"
        className="relative flex h-full w-full max-w-[640px] flex-col border-l-2 border-line bg-panel shadow-[-6px_0_0_var(--shadow-color)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-line px-5 py-4">
          <div>
            <h2 id="builder-panel-title" className="font-serif text-3xl leading-none">
              Builder <em>preview</em>
            </h2>
            <p className="mt-1.5 text-xs text-zinc-500">
              Your resume with the rewrites applied. Nothing is saved until you open it in the builder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Rewrites */}
        <div className="max-h-[38%] shrink-0 overflow-y-auto border-b-2 border-line px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-zinc-400">
              Rewrites · {appliedCount}/{bullets.length} applied
            </span>
            <button
              type="button"
              disabled={status === "loading" || pendingCount === 0}
              onClick={applier.applyAll}
              className="rf-btn min-h-9 gap-1.5 px-3 text-xs"
            >
              <Check size={13} /> Apply all
            </button>
          </div>
          <ul className="space-y-2">
            {bullets.map((bullet, idx) => {
              const state = states[idx] ?? { kind: "pending" };
              return (
                <li
                  key={idx}
                  className={`rounded-xl border-2 px-3 py-2.5 ${
                    state.kind === "applied" ? "border-line bg-marker/25" : "border-zinc-800"
                  }`}
                >
                  <p className="text-[13px] leading-snug text-zinc-200">{bullet.improved}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-zinc-500">
                      {state.kind === "applied" && resume
                        ? locationLabel(resume, state.loc)
                        : state.kind === "missing"
                          ? "Couldn't find the original line in the imported resume"
                          : "Not applied yet"}
                    </span>
                    {state.kind === "applied" ? (
                      <button
                        type="button"
                        onClick={() => applier.undo(idx)}
                        className="flex items-center gap-1 font-semibold text-zinc-400 hover:text-white"
                      >
                        <Undo2 size={12} /> Undo
                      </button>
                    ) : state.kind === "missing" ? (
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <AlertTriangle size={12} /> Edit it in the builder
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={status === "loading"}
                        onClick={() => applier.apply(idx)}
                        className="flex items-center gap-1 font-bold text-pencil hover:underline disabled:opacity-50"
                      >
                        <Check size={12} /> Apply
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Preview */}
        <div className="relative min-h-0 flex-1">
          {status === "loading" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas text-sm text-zinc-400">
              <Loader2 size={22} className="animate-spin text-pencil" />
              Reading your resume into the builder…
            </div>
          )}
          {status === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas px-8 text-center text-sm">
              <AlertTriangle size={22} className="text-pencil" />
              <p className="text-zinc-300">{error || "Couldn't import the resume for preview."}</p>
              <button type="button" onClick={applier.load} className="rf-btn gap-1.5 px-4 text-sm">
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          )}
          {status === "ready" && resume && (
            <BuilderPreview
              resume={resume}
              // Highlight the section the latest change landed in
              selectedSection={lastLocation ? locationSection(lastLocation) : "Profile"}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line px-5 py-3">
          <p className="text-xs text-zinc-500">Replaces the resume currently in your builder.</p>
          <button
            type="button"
            disabled={status !== "ready"}
            onClick={openInBuilder}
            className="rf-btn rf-btn-primary gap-1.5 px-4 text-sm"
          >
            Open in builder <ArrowRight size={14} />
          </button>
        </div>
      </aside>
    </div>
  );
}
