"use client";

import { useState } from "react";
import { Check, PanelRightOpen, Sparkles, Undo2 } from "lucide-react";
import type { ImprovedBullet } from "@/lib/analysis";
import { useBulletApplier } from "@/lib/useBulletApplier";
import BuilderSidePanel from "./BuilderSidePanel";

/**
 * Suggested rewrites with Apply / Undo. Applying opens the builder sidebar,
 * which previews the analyzed resume with the change in place.
 */
export default function ImprovedBullets({ file, bullets }: { file: File | null; bullets: ImprovedBullet[] }) {
  const applier = useBulletApplier(file, bullets);
  const [panelOpen, setPanelOpen] = useState(false);

  const applyAndShow = (idx: number) => {
    applier.apply(idx);
    setPanelOpen(true);
  };

  return (
    <div className="rf-card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Improved bullet recommendations</h4>
          <p className="mt-1 text-xs text-zinc-500">
            Apply a rewrite to see it in your resume. Nothing changes in the builder until you open it there.
          </p>
        </div>
        <button type="button" onClick={() => setPanelOpen(true)} className="rf-btn gap-1.5 px-3 text-sm">
          <PanelRightOpen size={15} />
          Preview in builder
          {applier.appliedCount > 0 && (
            <span className="rf-sticker px-1.5 text-[11px]">{applier.appliedCount}</span>
          )}
        </button>
      </div>

      <div className="space-y-3">
        {bullets.map((bullet, idx) => {
          const state = applier.states[idx]?.kind ?? "pending";
          return (
            <div
              key={idx}
              className={`grid gap-4 rounded-xl border-2 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] ${
                state === "applied" ? "border-line bg-marker/20" : "border-zinc-800 bg-card/50"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Original</span>
                <p
                  className={`text-xs italic text-zinc-400 ${
                    state === "applied" ? "line-through decoration-pencil decoration-2" : ""
                  }`}
                >
                  &ldquo;{bullet.original}&rdquo;
                </p>
              </div>
              <div className="space-y-1 border-t border-zinc-800 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-pencil">
                  <Sparkles size={10} /> Improved
                </span>
                <p className="text-xs text-zinc-200">&ldquo;{bullet.improved}&rdquo;</p>
              </div>
              <div className="flex items-start md:justify-end">
                {state === "applied" ? (
                  <button type="button" onClick={() => applier.undo(idx)} className="rf-btn min-h-9 gap-1 px-3 text-xs">
                    <Undo2 size={12} /> Undo
                  </button>
                ) : state === "missing" ? (
                  <span className="max-w-[9rem] text-[11px] leading-snug text-amber-400">
                    Not found in the imported resume
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => applyAndShow(idx)}
                    className="rf-btn rf-btn-primary min-h-9 gap-1 px-3 text-xs"
                  >
                    <Check size={12} /> Apply
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BuilderSidePanel open={panelOpen} onClose={() => setPanelOpen(false)} applier={applier} bullets={bullets} />
    </div>
  );
}
