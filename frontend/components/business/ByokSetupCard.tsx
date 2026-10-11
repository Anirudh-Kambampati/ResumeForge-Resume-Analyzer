"use client";

import { useEffect } from "react";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { BYOK_PROVIDERS, useAiKeyStore, type ByokProvider } from "@/store/aiKeyStore";

const PROVIDERS: ByokProvider[] = ["openai", "anthropic", "gemini", "groq", "openrouter"];
// The dialog opens on its own once per browser session, not on every visit
const PROMPTED_KEY = "resumeforge-byok-prompted";

/** Key state for business pages; `ready` is false until storage has been read. */
export function useByokStatus() {
  const hydrated = useAiKeyStore((s) => s.hydrated);
  const hasKey = useAiKeyStore((s) => s.config !== null);
  const hydrate = useAiKeyStore((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  return { ready: hydrated, hasKey };
}

/**
 * Step one of the business workspace: connect an AI key. Shown until a key
 * is saved, and opens the key dialog automatically on the first visit.
 */
export default function ByokSetupCard({ autoPrompt = true }: { autoPrompt?: boolean }) {
  const { ready, hasKey } = useByokStatus();
  const openDialog = useAiKeyStore((s) => s.openDialog);

  useEffect(() => {
    if (!autoPrompt || !ready || hasKey) return;
    try {
      if (sessionStorage.getItem(PROMPTED_KEY)) return;
      sessionStorage.setItem(PROMPTED_KEY, "1");
    } catch {
      // Storage blocked: still prompt, just can't remember that we did
    }
    openDialog("byok_required");
  }, [autoPrompt, ready, hasKey, openDialog]);

  if (!ready || hasKey) return null;

  return (
    <section
      aria-labelledby="byok-setup-title"
      className="rf-note relative overflow-hidden p-5 sm:p-6"
      // globals.css gives every <section> a full-screen snap height
      style={{ minHeight: 0, scrollSnapAlign: "none" }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 -rotate-3 items-center justify-center rounded-xl border-2 border-line bg-panel text-white">
            <KeyRound size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">First step</p>
            <h2 id="byok-setup-title" className="mt-1 text-lg font-bold tracking-tight text-white">
              Connect your AI key
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">
              ResumeForge for Businesses runs its AI on your own key: reading each job description,
              summarising every resume, and writing candidate briefs. Scoring and ranking are free
              and need no key.
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Supported providers">
              {PROVIDERS.map((p) => (
                <li
                  key={p}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300"
                >
                  {BYOK_PROVIDERS[p].label.replace("Google ", "")}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <button
            type="button"
            onClick={() => openDialog("byok_required")}
            className="flex items-center gap-2 rf-btn rf-btn-primary px-5 text-sm"
          >
            <KeyRound size={15} /> Add your AI key
          </button>
          <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck size={12} /> Stays in your browser · never stored on our servers
          </p>
        </div>
      </div>
    </section>
  );
}

/** Small confirmation shown once a key is connected. */
export function ByokConnectedNote() {
  const config = useAiKeyStore((s) => s.config);
  const openDialog = useAiKeyStore((s) => s.openDialog);
  if (!config) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
      <CheckCircle2 size={13} className="text-green-400" />
      AI runs on your {BYOK_PROVIDERS[config.provider].label} key.
      <button type="button" onClick={() => openDialog("manual")} className="text-blue-400 hover:text-blue-300">
        Change
      </button>
    </p>
  );
}
