"use client";

import { useEffect, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { ResumePDFDocument } from "./preview/ResumePDFDocument";
import { useResumeStore } from "@/store/resumeStore";
import { apiPostForm } from "@/lib/api";
import { normalizeError } from "@/lib/errorHelper";
import {
  type AnalysisResult,
  type TextLocation,
  locateText,
  locationLabel,
  locationSection,
  readText,
  resumeFingerprint,
  writeText,
} from "@/lib/analysis";

type Props = { onClose: () => void };

type Applied = { loc: TextLocation; previous: string; improved: string };

export default function AnalysisPanel({ onClose }: Props) {
  const resume = useResumeStore((s) => s.resume);
  const setResume = useResumeStore((s) => s.setResume);
  const setSelectedSection = useResumeStore((s) => s.setSelectedSection);

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // Fingerprint of the resume the results describe; Apply/Undo keep it in sync.
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<number, Applied>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runAnalysis = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = resume;

    setStatus("loading");
    setError(null);
    try {
      // Analyze the exact PDF the user would export
      const blob = await pdf(<ResumePDFDocument resume={snapshot} />).toBlob();
      const formData = new FormData();
      formData.append("resume", new File([blob], "resume.pdf", { type: "application/pdf" }));
      const data = await apiPostForm<AnalysisResult>("/api/analyze", formData, controller.signal);
      setResult(data);
      setApplied({});
      setAnalyzedFingerprint(resumeFingerprint(snapshot));
      setStatus("done");
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message =
        e instanceof TypeError
          ? "Could not connect to the analysis server. Make sure the backend is running."
          : e instanceof Error
            ? e.message
            : normalizeError(e);
      setError(message);
      setStatus("error");
    }
  };

  const isStale =
    status === "done" && analyzedFingerprint !== null && analyzedFingerprint !== resumeFingerprint(resume);

  const commit = (next: typeof resume) => {
    setResume(next);
    // Our own edits don't make the analysis stale
    if (!isStale) setAnalyzedFingerprint(resumeFingerprint(next));
  };

  const applyBullet = (idx: number, loc: TextLocation, improved: string) => {
    const previous = readText(resume, loc);
    if (previous === undefined) return;
    commit(writeText(resume, loc, improved));
    setApplied((a) => ({ ...a, [idx]: { loc, previous, improved } }));
  };

  const undoBullet = (idx: number) => {
    const entry = applied[idx];
    if (!entry) return;
    // Only undo if the text is still what we applied
    if (readText(resume, entry.loc) === entry.improved) {
      commit(writeText(resume, entry.loc, entry.previous));
    }
    setApplied((a) => {
      const next = { ...a };
      delete next[idx];
      return next;
    });
  };

  const copyText = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } catch {
      // Clipboard can be blocked; nothing else to do
    }
  };

  return (
    // Fills the preview area, so content is centered at a readable width
    <aside className="flex h-full flex-col bg-panel">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Resume Analysis</h3>
            <p className="text-xs text-zinc-500">Close to return to the preview</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close analysis panel"
          >
            <X size={16} /> Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        {/* Run / re-run */}
        {status !== "loading" && (
          <button
            type="button"
            onClick={runAnalysis}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-blue-500"
          >
            {result ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            {result ? "Re-analyze" : "Analyze my resume"}
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-zinc-400">
            <Loader2 size={16} className="animate-spin" />
            Analyzing your resume… this can take up to a minute.
          </div>
        )}

        {status === "error" && error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isStale && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Your resume changed since this analysis. Re-analyze for up-to-date scores.</span>
          </div>
        )}

        {result && status !== "loading" && (
          <>
            {/* Scores */}
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard label="ATS Score" score={result.scores.deterministic_rule_score} />
              <ScoreCard label="AI Review" score={result.scores.ai_review_score} />
            </div>

            {result.ai_review_available === false && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {result.ai_review_error || "The AI review could not be completed."} The ATS score is still
                  accurate; re-analyze to try the AI review again.
                </span>
              </div>
            )}

            {result.summary && (
              <p className="text-xs leading-relaxed text-zinc-400">{result.summary}</p>
            )}

            {/* Rewritten bullets — the actionable part */}
            <section className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Improved Bullets ({result.improved_bullets.length})
              </h4>
              {result.improved_bullets.length === 0 && (
                <p className="text-xs text-zinc-600">No bullet rewrites suggested.</p>
              )}
              {result.improved_bullets.map((bullet, idx) => {
                const done = applied[idx];
                const loc = done?.loc ?? locateText(resume, bullet.original);
                return (
                  <div key={idx} className="space-y-2 rounded-xl border border-white/10 bg-card p-3">
                    {loc && (
                      <button
                        type="button"
                        onClick={() => setSelectedSection(locationSection(loc))}
                        className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 hover:text-blue-300"
                      >
                        {locationLabel(resume, loc)}
                      </button>
                    )}
                    <p className="text-xs italic text-zinc-500 line-through decoration-zinc-700">
                      {bullet.original}
                    </p>
                    <p className="text-xs text-zinc-200">{bullet.improved}</p>
                    <div className="flex items-center gap-2 pt-1">
                      {done ? (
                        <>
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 size={13} /> Applied
                          </span>
                          <button
                            type="button"
                            onClick={() => undoBullet(idx)}
                            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/5"
                          >
                            <Undo2 size={12} /> Undo
                          </button>
                        </>
                      ) : loc ? (
                        <button
                          type="button"
                          onClick={() => applyBullet(idx, loc, bullet.improved)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600/90 px-2.5 py-1 text-xs font-medium text-on-accent transition hover:bg-blue-500"
                        >
                          <Check size={12} /> Apply
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => copyText(idx, bullet.improved)}
                            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/5"
                          >
                            <Copy size={12} /> {copiedIdx === idx ? "Copied" : "Copy"}
                          </button>
                          <span className="text-[11px] text-zinc-600">Couldn&apos;t find this bullet in your resume</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <ListSection title="Strengths" items={result.strengths} tone="green" />
              <ListSection title="Gaps & Weaknesses" items={result.weaknesses} tone="red" />
            </div>

            {/* General suggestions (read-only) */}
            {result.suggestions.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Suggestions</h4>
                {result.suggestions.map((s, idx) => (
                  <div key={idx} className="rounded-xl border border-white/5 bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-xs font-semibold text-white">{s.title}</h5>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                          s.priority === "high"
                            ? "bg-red-500/20 text-red-400"
                            : s.priority === "medium"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {s.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.description}</p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      </div>
    </aside>
  );
}

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  const color =
    score === null ? "text-zinc-600" : score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="rounded-xl border border-white/10 bg-card p-3">
      <div className="text-[11px] font-medium text-zinc-500">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>
        {score ?? "—"}
        <span className="text-xs font-medium text-zinc-600">/100</span>
      </div>
    </div>
  );
}

function ListSection({ title, items, tone }: { title: string; items: string[]; tone: "green" | "red" }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
            <span className={`mt-0.5 font-bold ${tone === "green" ? "text-green-500" : "text-red-500"}`}>&bull;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
