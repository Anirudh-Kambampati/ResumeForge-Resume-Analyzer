"use client";

import { AlertTriangle, CheckCircle2, Loader2, MessageSquareQuote, RefreshCw, Sparkles } from "lucide-react";
import type { Candidate } from "@/types/screening";
import { useScreeningStore } from "@/store/screeningStore";

function Chips({ items, tone, empty }: { items: string[]; tone: "match" | "miss"; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-zinc-600">{empty}</p>;
  const cls =
    tone === "match"
      ? "rf-chip-found"
      : "rf-chip-missing";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`px-2 py-0.5 text-xs ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function BriefList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {icon}
        {title}
      </h5>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Score breakdown, evidence and the optional AI brief for one candidate. */
export default function CandidateDetail({ queueId, candidate }: { queueId: string; candidate: Candidate }) {
  const requestBrief = useScreeningStore((s) => s.requestBrief);
  const result = candidate.result;
  if (!result) return null;

  return (
    <div className="grid gap-6 border-t border-white/5 bg-white/[0.015] px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Evidence */}
      <div className="space-y-5">
        <div className="space-y-2.5">
          {result.categories.map((cat) => (
            <div key={cat.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-400">{cat.label}</span>
                <span className="font-semibold text-zinc-300">
                  {cat.score}
                  <span className="text-zinc-600">/{cat.max_score}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${(cat.score / Math.max(1, cat.max_score)) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Required skills found</h5>
            <Chips items={result.required_skills.matched} tone="match" empty="None of the required skills were found." />
          </div>
          <div>
            <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Required skills missing</h5>
            <Chips items={result.required_skills.missing} tone="miss" empty="All required skills are present." />
          </div>
          {result.preferred_skills.matched.length + result.preferred_skills.missing.length > 0 && (
            <div>
              <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Preferred skills found</h5>
              <Chips items={result.preferred_skills.matched} tone="match" empty="No preferred skills found." />
            </div>
          )}
        </div>
      </div>

      {/* AI brief */}
      <div className="rf-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles size={15} className="text-purple-400" />
            AI candidate brief
          </h4>
          {candidate.briefStatus === "done" && (
            <button
              type="button"
              onClick={() => requestBrief(queueId, candidate.id)}
              className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-white"
            >
              <RefreshCw size={12} /> Regenerate
            </button>
          )}
        </div>

        {(candidate.briefStatus === "idle" || candidate.briefStatus === "error") && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-zinc-400">
              A short summary of how this candidate&apos;s evidence lines up with the role, the gaps, and
              questions to ask. Generated on demand, grounded in the resume only.
            </p>
            {candidate.briefError && (
              <p className="flex items-start gap-1.5 text-xs text-red-400">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {candidate.briefError}
              </p>
            )}
            <button
              type="button"
              onClick={() => requestBrief(queueId, candidate.id)}
              className="rf-btn rf-btn-primary px-4 text-sm"
            >
              {candidate.briefError ? "Try again" : "Generate brief"}
            </button>
          </div>
        )}

        {(candidate.briefStatus === "queued" || candidate.briefStatus === "loading") && (
          <p className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 size={15} className="animate-spin" />
            {candidate.briefStatus === "queued" ? "Waiting for a free slot…" : "Writing brief…"}
          </p>
        )}

        {candidate.briefStatus === "done" && candidate.brief && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-zinc-300">{candidate.brief.summary}</p>
            <BriefList
              title="Strengths"
              items={candidate.brief.strengths}
              icon={<CheckCircle2 size={12} className="text-green-400" />}
            />
            <BriefList
              title="Gaps"
              items={candidate.brief.gaps}
              icon={<AlertTriangle size={12} className="text-amber-400" />}
            />
            <BriefList
              title="Interview questions"
              items={candidate.brief.interview_questions}
              icon={<MessageSquareQuote size={12} className="text-blue-400" />}
            />
            <p className="border-t border-white/5 pt-3 text-[11px] leading-relaxed text-zinc-600">
              AI-generated from the resume text. Verify before relying on it; it is not a hiring decision.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
