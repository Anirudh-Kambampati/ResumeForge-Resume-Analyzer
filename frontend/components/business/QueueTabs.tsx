"use client";

import { Plus } from "lucide-react";
import { queueProgress } from "@/lib/screening";
import { useScreeningStore } from "@/store/screeningStore";
import type { ScreeningQueue } from "@/types/screening";

function statusDot(queue: ScreeningQueue): { cls: string; label: string } {
  const p = queueProgress(queue);
  if (queue.status === "paused") return { cls: "bg-amber-400", label: "Paused" };
  if (queue.status === "draft") return { cls: "bg-zinc-500", label: "Draft" };
  if (p.active + p.pending > 0) return { cls: "bg-blue-400 animate-pulse", label: "Screening" };
  return { cls: "bg-green-400", label: "Complete" };
}

/** One tab per job opening, with live progress, so parallel queues stay visible. */
export default function QueueTabs() {
  const queues = useScreeningStore((s) => s.queues);
  const selectedId = useScreeningStore((s) => s.selectedQueueId);
  const selectQueue = useScreeningStore((s) => s.selectQueue);
  const createQueue = useScreeningStore((s) => s.createQueue);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Screening queues">
      {queues.map((q) => {
        const p = queueProgress(q);
        const dot = statusDot(q);
        const pct = p.total ? ((p.done + p.failed) / p.total) * 100 : 0;
        const selected = q.id === selectedId;
        return (
          <button
            key={q.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => selectQueue(q.id)}
            // Manila folder tabs: the open one is a clean sheet, the rest sit behind it
            className={`relative min-w-[11rem] max-w-[15rem] shrink-0 overflow-hidden rounded-b-md rounded-t-2xl border-2 border-line px-4 py-2.5 text-left transition ${
              selected
                ? "bg-panel shadow-[3px_3px_0_var(--shadow-color)]"
                : "mt-1 bg-zinc-900 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot.cls}`} title={dot.label} />
              <span className="truncate text-sm font-extrabold text-white">{q.name || "Untitled"}</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {dot.label} · {p.done}/{p.total} screened
              {p.failed > 0 && <span className="text-red-400"> · {p.failed} failed</span>}
            </p>
            {p.total > 0 && (
              <span className="absolute inset-x-0 bottom-0 h-1 bg-white/[0.06]">
                <span className="block h-full bg-line transition-all duration-500" style={{ width: `${pct}%` }} />
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => createQueue()}
        className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-600 px-4 py-2.5 text-sm font-bold text-zinc-400 transition hover:border-line hover:text-white"
      >
        <Plus size={15} /> New queue
      </button>
    </div>
  );
}
