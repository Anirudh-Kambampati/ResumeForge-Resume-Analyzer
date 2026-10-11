"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Eraser,
  KeyRound,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ScreeningQueue } from "@/types/screening";
import { MIN_JOB_DESCRIPTION_CHARS, queueProgress } from "@/lib/screening";
import { useScreeningStore, clearPersistedScreening } from "@/store/screeningStore";
import RequirementsEditor from "./RequirementsEditor";
import ResumeDropzone from "./ResumeDropzone";
import CandidateTable from "./CandidateTable";
import ExportMenu from "./ExportMenu";
import { useByokStatus } from "./ByokSetupCard";
import { useAiKeyStore } from "@/store/aiKeyStore";

const TOP_BRIEF_COUNT = 5;

const secondaryButton =
  "rf-btn gap-1.5 px-3 text-sm";

/** Setup (JD → requirements → resumes) and ranked results for one queue. */
export default function QueueWorkspace({ queue }: { queue: ScreeningQueue }) {
  const renameQueue = useScreeningStore((s) => s.renameQueue);
  const setJobDescription = useScreeningStore((s) => s.setJobDescription);
  const loadRequirements = useScreeningStore((s) => s.loadRequirements);
  const startQueue = useScreeningStore((s) => s.startQueue);
  const pauseQueue = useScreeningStore((s) => s.pauseQueue);
  const retryFailed = useScreeningStore((s) => s.retryFailed);
  const rescoreQueue = useScreeningStore((s) => s.rescoreQueue);
  const removeQueue = useScreeningStore((s) => s.removeQueue);
  const requestTopBriefs = useScreeningStore((s) => s.requestTopBriefs);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const openKeyDialog = useAiKeyStore((s) => s.openDialog);
  const byok = useByokStatus();
  // AI buttons lead to key setup instead of failing when no key is connected
  const needsKey = byok.ready && !byok.hasKey;

  const progress = queueProgress(queue);
  const jdLength = queue.jobDescription.trim().length;
  const loadingRequirements = queue.requirementsStatus === "loading";
  const canStart = !!queue.requirements && queue.status !== "running";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ---------- Setup column ---------- */}
      <div className="space-y-5">
        <div className="rf-card p-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Queue name
          </label>
          <input
            value={queue.name}
            onChange={(e) => renameQueue(queue.id, e.target.value)}
            className="w-full rounded-xl border-2 border-line bg-panel px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-marker/70"
          />

          <div className="mt-4 mb-1.5 flex items-baseline justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              1 · Job description
            </label>
            <span className="text-[11px] text-zinc-600">{jdLength} chars</span>
          </div>
          <textarea
            value={queue.jobDescription}
            onChange={(e) => setJobDescription(queue.id, e.target.value)}
            placeholder="Paste the full job posting: title, responsibilities, required and preferred qualifications…"
            rows={queue.requirements ? 5 : 10}
            className="w-full resize-y rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-marker/70"
          />
          {queue.requirementsError && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {queue.requirementsError}
            </p>
          )}
          {needsKey ? (
            <button
              type="button"
              onClick={() => openKeyDialog("byok_required")}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rf-btn rf-btn-primary px-4 text-sm"
            >
              <KeyRound size={15} /> Add AI key to extract requirements
            </button>
          ) : (
          <button
            type="button"
            disabled={jdLength < MIN_JOB_DESCRIPTION_CHARS || loadingRequirements}
            onClick={() => loadRequirements(queue.id)}
            className={`mt-3 w-full justify-center ${
              queue.requirements
                ? secondaryButton
                : "flex items-center gap-1.5 rf-btn rf-btn-primary px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {loadingRequirements ? (
              <Loader2 size={15} className="animate-spin" />
            ) : queue.requirements ? (
              <RefreshCw size={14} />
            ) : (
              <Sparkles size={15} />
            )}
            {loadingRequirements
              ? "Reading job description…"
              : queue.requirements
                ? "Re-extract requirements"
                : "Extract requirements"}
          </button>
          )}
          {jdLength > 0 && jdLength < MIN_JOB_DESCRIPTION_CHARS && (
            <p className="mt-2 text-[11px] text-zinc-600">
              Paste at least {MIN_JOB_DESCRIPTION_CHARS} characters.
            </p>
          )}
        </div>

        {queue.requirements && (
          <div className="rf-card p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              2 · Review requirements
            </h3>
            <RequirementsEditor queue={queue} />
          </div>
        )}

        <div className="rf-card p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {queue.requirements ? "3" : "2"} · Add resumes
          </h3>
          <ResumeDropzone queueId={queue.id} compact={queue.candidates.length > 0} />
          {!queue.requirements && queue.candidates.length > 0 && (
            <p className="mt-2 text-[11px] text-zinc-500">
              Resumes wait in line until requirements are extracted and the queue is started.
            </p>
          )}
        </div>
      </div>

      {/* ---------- Results column ---------- */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-4xl font-normal leading-none text-white">The stack, <em>sorted</em></h2>
            <p className="text-xs text-zinc-500">
              {progress.total === 0
                ? "Nothing screened yet"
                : `${progress.done} screened · ${progress.active} in progress · ${progress.pending} waiting${
                    progress.failed ? ` · ${progress.failed} failed` : ""
                  }`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {queue.status === "running" ? (
              progress.active + progress.pending > 0 && (
                <button type="button" onClick={() => pauseQueue(queue.id)} className={secondaryButton}>
                  <Pause size={14} /> Pause
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => startQueue(queue.id)}
                className="flex items-center gap-1.5 rf-btn rf-btn-primary px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                title={queue.requirements ? undefined : "Extract requirements first"}
              >
                <Play size={14} /> {queue.status === "paused" ? "Resume" : "Start screening"}
              </button>
            )}
            {progress.failed > 0 && (
              <button type="button" onClick={() => retryFailed(queue.id)} className={secondaryButton}>
                <RotateCcw size={14} /> Retry failed
              </button>
            )}
            <button
              type="button"
              disabled={progress.done === 0}
              onClick={() =>
                needsKey ? openKeyDialog("byok_required") : requestTopBriefs(queue.id, TOP_BRIEF_COUNT)
              }
              className={secondaryButton}
              title={`Generate AI briefs for the top ${TOP_BRIEF_COUNT} candidates`}
            >
              <Sparkles size={14} className="text-purple-400" /> Brief top {TOP_BRIEF_COUNT}
            </button>
            <ExportMenu queue={queue} disabled={progress.done === 0} className={secondaryButton} />
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear this browser's saved screening results? Rankings and briefs in every queue are erased.")) {
                  clearPersistedScreening();
                  window.location.reload();
                }
              }}
              className={secondaryButton}
              title="Clear saved results from this browser"
            >
              <Eraser size={14} /> Clear saved
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => removeQueue(queue.id)}
                  className="rf-btn border-pencil bg-pencil px-3 text-sm text-black"
                >
                  Delete queue
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={secondaryButton}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={`${secondaryButton} hover:text-red-400`}
                aria-label="Delete queue"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {queue.requirementsDirty && (
          <div className="rf-note flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-amber-300">
              Requirements changed. Existing scores use the previous version.
            </p>
            <button type="button" onClick={() => rescoreQueue(queue.id)} className={secondaryButton}>
              <RefreshCw size={14} /> Re-score all
            </button>
          </div>
        )}

        {queue.status === "draft" && queue.requirements && queue.candidates.length > 0 && (
          <div className="rf-note px-4 py-3 text-sm">
            {queue.candidates.length} resume{queue.candidates.length === 1 ? "" : "s"} ready. Review the
            requirements, then press <span className="font-semibold">Start screening</span>.
          </div>
        )}

        <CandidateTable queue={queue} />
      </div>
    </div>
  );
}
