"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Lock } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AiKeyButton from "@/components/ai/AiKeyButton";
import QueueTabs from "@/components/business/QueueTabs";
import QueueWorkspace from "@/components/business/QueueWorkspace";
import ByokSetupCard, { ByokConnectedNote, useByokStatus } from "@/components/business/ByokSetupCard";
import { MAX_ACTIVE_TOTAL, useScreeningStore } from "@/store/screeningStore";

export default function ScreeningPage() {
  const queues = useScreeningStore((s) => s.queues);
  const selectedId = useScreeningStore((s) => s.selectedQueueId);
  const createQueue = useScreeningStore((s) => s.createQueue);
  const hydrateFromPersisted = useScreeningStore((s) => s.hydrateFromPersisted);
  const [hydrated, setHydrated] = useState(false);
  const byok = useByokStatus();
  const needsKey = byok.ready && !byok.hasKey;

  // SSR rendered with an empty store; swap in the localStorage snapshot after
  // mount so server HTML and first client render agree.
  useEffect(() => {
    hydrateFromPersisted();
    setHydrated(true);
  }, [hydrateFromPersisted]);

  const selected = queues.find((q) => q.id === selectedId) ?? null;

  const active = queues.reduce(
    (n, q) => n + q.candidates.filter((c) => c.status === "screening").length,
    0,
  );
  const runningQueues = queues.filter((q) =>
    q.candidates.some((c) => c.status === "screening"),
  ).length;
  const hasWork = queues.some((q) => q.candidates.length > 0);

  // Results exist only in this tab — warn before they are thrown away.
  useEffect(() => {
    if (!hasWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasWork]);

  return (
    <main className="min-h-screen bg-app pb-20 text-zinc-100">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-3 border-b-2 border-line bg-app/95 px-4 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/business"
            className="-ml-2 rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Back to ResumeForge for Businesses"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[26px] font-normal leading-none">Candidate Screening</h1>
            <p className="truncate text-xs text-zinc-500">ResumeForge for Businesses</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {active > 0 && (
            <span className="hidden items-center gap-2 rounded-full border-2 border-line bg-marker px-3 py-1.5 text-xs font-bold text-[#1f1b16] sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1f1b16]" />
              {active}/{MAX_ACTIVE_TOTAL} slots · {runningQueues} queue{runningQueues === 1 ? "" : "s"}
            </span>
          )}
          <AiKeyButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-7xl space-y-6 px-4 sm:px-6">
        {/* Business AI runs on the user's key: ask for it before anything else */}
        <ByokSetupCard />

        {queues.length === 0 ? (
          <div className={`mx-auto max-w-xl text-center ${needsKey ? "mt-10" : "mt-16"}`} aria-live={hydrated ? "polite" : undefined}>
            <div className="mx-auto flex h-12 w-12 -rotate-3 items-center justify-center rounded-2xl border-2 border-line bg-marker text-[#1f1b16] shadow-[3px_3px_0_var(--shadow-color)]">
              <Layers size={22} />
            </div>
            {needsKey && (
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Then</p>
            )}
            <h2 className={`${needsKey ? "mt-1" : "mt-5"} font-serif text-5xl font-normal`}>Start your first queue</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              A queue is one job opening: its description and the resumes you received for it. Create
              as many as you need; they screen in parallel.
            </p>
            <button
              type="button"
              onClick={() => createQueue()}
              className={
                needsKey
                  ? "rf-btn mt-7 min-h-[52px] px-7"
                  : "mt-7 rf-btn rf-btn-primary min-h-[52px] px-7"
              }
            >
              Create a queue
            </button>
            {!needsKey && (
              <div className="mt-4 flex justify-center">
                <ByokConnectedNote />
              </div>
            )}
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-600">
              <Lock size={12} /> Resumes are processed and discarded. Rankings, summaries and briefs
              stay in this browser only; use "Clear saved" to erase them.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              Scoring is free. Requirement extraction, per-resume summaries and briefs use your own
              AI key.
            </p>
          </div>
        ) : (
          <>
            <QueueTabs />
            {selected && <QueueWorkspace key={selected.id} queue={selected} />}
          </>
        )}
      </div>
    </main>
  );
}
