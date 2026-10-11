"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, ChevronDown, Clock, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { ScreeningQueue } from "@/types/screening";
import { candidateDisplayName, rankCandidates, scoreSticker } from "@/lib/screening";
import { useScreeningStore } from "@/store/screeningStore";
import CandidateDetail from "./CandidateDetail";

const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_4rem_2rem] md:grid-cols-[2.5rem_minmax(0,1.4fr)_5rem_6rem_minmax(0,1fr)_4rem_2.5rem] items-center gap-3";

/** Ranked candidates for one queue. Rows expand into the score breakdown and AI brief. */
export default function CandidateTable({ queue }: { queue: ScreeningQueue }) {
  const removeCandidate = useScreeningStore((s) => s.removeCandidate);
  const requestSummary = useScreeningStore((s) => s.requestSummary);
  const [expanded, setExpanded] = useState<string | null>(null);
  const ranked = rankCandidates(queue.candidates);

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-zinc-700 px-6 py-12 text-center">
        <p className="text-sm text-zinc-400">No resumes in this queue yet.</p>
        <p className="mt-1 text-xs text-zinc-600">Ranked candidates appear here as they are screened.</p>
      </div>
    );
  }

  let rank = 0;
  return (
    <div className="rf-card overflow-hidden">
      <div className={`${GRID} border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6`}>
        <span>#</span>
        <span>Candidate</span>
        <span className="text-right">Match</span>
        <span className="hidden text-center md:block">Required</span>
        <span className="hidden md:block">AI summary</span>
        <span className="hidden text-right md:block">ATS</span>
        <span />
      </div>

      {ranked.map((c) => {
        const r = c.result;
        const isOpen = expanded === c.id && !!r;
        const requiredTotal = r ? r.required_skills.matched.length + r.required_skills.missing.length : 0;
        return (
          <Fragment key={c.id}>
            <div
              className={`${GRID} border-b border-white/5 px-4 py-3 transition sm:px-6 ${
                r ? "cursor-pointer hover:bg-white/[0.02]" : ""
              } ${isOpen ? "bg-white/[0.02]" : ""}`}
              onClick={() => r && setExpanded(isOpen ? null : c.id)}
            >
              <span className="font-serif text-3xl leading-none text-white">{r ? ++rank : "–"}</span>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                  <span className="truncate">{candidateDisplayName(c)}</span>
                  {c.briefStatus === "done" && <Sparkles size={12} className="shrink-0 text-purple-400" aria-label="Brief ready" />}
                  {(c.briefStatus === "queued" || c.briefStatus === "loading") && (
                    <Loader2 size={12} className="shrink-0 animate-spin text-purple-400" aria-label="Writing brief" />
                  )}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {c.status === "error" ? (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <AlertTriangle size={11} /> {c.error}
                    </span>
                  ) : (
                    r?.candidate.email ?? c.fileName
                  )}
                </p>
              </div>

              <div className="text-right">
                {r ? (
                  <span className={`ml-auto h-11 w-11 text-xl shadow-none ${scoreSticker(r.match_score)}`}>{r.match_score}</span>
                ) : c.status === "screening" ? (
                  <Loader2 size={16} className="ml-auto animate-spin text-blue-400" />
                ) : c.status === "queued" ? (
                  <Clock size={15} className="ml-auto text-zinc-600" aria-label="Queued" />
                ) : (
                  <span className="text-xs text-red-400">Failed</span>
                )}
              </div>

              <span
                className="hidden text-center text-sm text-zinc-300 md:block"
                title={r && requiredTotal === 0 ? "No required skills in this queue — add them under Review requirements" : undefined}
              >
                {r ? (requiredTotal ? `${r.required_skills.matched.length}/${requiredTotal}` : "–") : ""}
              </span>

              <div className="hidden min-w-0 items-center gap-1.5 md:flex">
                {(c.summaryStatus === "loading" || c.summaryStatus === "queued") && (
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Loader2 size={11} className="shrink-0 animate-spin text-purple-400" aria-label="Writing summary" />
                    <span className="truncate">Summarizing…</span>
                  </span>
                )}
                {c.summaryStatus === "done" && c.aiSummary && (
                  <div className="flex min-w-0 items-start gap-1.5">
                    <Sparkles size={12} className="mt-0.5 shrink-0 text-purple-400" aria-label="AI summary" />
                    <p className="whitespace-normal wrap-break-word text-xs leading-relaxed text-zinc-400">{c.aiSummary}</p>
                  </div>
                )}
                {c.summaryStatus === "idle" && r && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestSummary(queue.id, c.id);
                    }}
                    className="truncate text-[11px] text-zinc-600 transition hover:text-purple-300"
                    title="Generate a one-line AI take on this candidate"
                  >
                    Summarize
                  </button>
                )}
                {c.summaryStatus === "error" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestSummary(queue.id, c.id);
                    }}
                    className="truncate text-[11px] text-red-400 transition hover:text-red-300"
                    title={c.summaryError ?? "Summary failed"}
                  >
                    Retry summary
                  </button>
                )}
              </div>

              <span className="hidden text-right text-sm text-zinc-400 md:block">{r?.ats_score ?? ""}</span>

              <div className="flex justify-end">
                {r ? (
                  <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCandidate(queue.id, c.id);
                    }}
                    className="rounded-lg p-1 text-zinc-600 transition hover:bg-white/5 hover:text-red-400"
                    aria-label={`Remove ${c.fileName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {isOpen && (
              <div>
                <CandidateDetail queueId={queue.id} candidate={c} />
                <div className="flex justify-end border-b border-white/5 px-4 pb-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => removeCandidate(queue.id, c.id)}
                    className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-red-400"
                  >
                    <Trash2 size={12} /> Remove candidate
                  </button>
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
