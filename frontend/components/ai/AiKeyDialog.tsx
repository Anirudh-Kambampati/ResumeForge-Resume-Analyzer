"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import {
  BYOK_PROVIDERS,
  byokHeaders,
  useAiKeyStore,
  type AiKeyReason,
  type ByokConfig,
  type ByokProvider,
} from "@/store/aiKeyStore";
import { API_BASE_URL, toApiError } from "@/lib/api";

const REASONS: Record<AiKeyReason, { title: string; body: string; tone: "info" | "warn" }> = {
  manual: {
    title: "Your AI key",
    body: "ResumeForge's free AI comes first. Your key is used only when that runs out, and for ResumeForge for Businesses.",
    tone: "info",
  },
  server_exhausted: {
    title: "Free AI capacity is used up",
    body: "ResumeForge's free AI is busy right now. Add your own key to keep going; it's used only when ours runs out.",
    tone: "warn",
  },
  byok_required: {
    title: "Business AI uses your own key",
    body: "Requirement extraction, per-resume summaries and candidate briefs run on your key. Scoring and ranking stay free and need no key.",
    tone: "info",
  },
  byok_invalid: {
    title: "Your key was rejected",
    body: "The provider didn't accept this key. Check it and try again.",
    tone: "warn",
  },
  byok_exhausted: {
    title: "Your key is out of credit",
    body: "Your provider reports a rate limit or no remaining credit. Top up, wait, or switch keys.",
    tone: "warn",
  },
  byok_model: {
    title: "Model not available",
    body: "Your key can't use the selected model. Pick another model or leave it blank for the default.",
    tone: "warn",
  },
  byok_unavailable: {
    title: "AI provider unreachable",
    body: "The provider timed out or refused the connection using your key. Try again in a moment, or switch providers in AI settings.",
    tone: "warn",
  },
};

const PROVIDER_ORDER: ByokProvider[] = ["openai", "anthropic", "gemini", "groq", "openrouter"];

const inputClass =
  "w-full rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-marker/70";

type CheckState = { status: "idle" | "checking" | "ok" | "error"; message?: string };

async function checkKey(config: ByokConfig): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/ai/key-check`, {
    method: "POST",
    headers: byokHeaders(config),
  });
  if (!response.ok) throw await toApiError(response);
  const data = (await response.json()) as { model: string };
  return data.model;
}

/** Global dialog for the user's own AI key. Opened from AI settings buttons or by AI errors. */
export default function AiKeyDialog() {
  const dialogOpen = useAiKeyStore((s) => s.dialogOpen);
  const hydrate = useAiKeyStore((s) => s.hydrate);
  const closeDialog = useAiKeyStore((s) => s.closeDialog);

  useEffect(() => hydrate(), [hydrate]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDialog();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, closeDialog]);

  // Mounting the panel only while open means its form starts from the saved key each time
  return dialogOpen ? <AiKeyPanel /> : null;
}

function AiKeyPanel() {
  const { config, dialogReason, saveConfig, clearConfig, closeDialog } = useAiKeyStore();

  const [provider, setProvider] = useState<ByokProvider>(config?.provider ?? "openai");
  const [model, setModel] = useState(config?.model ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [remember, setRemember] = useState(config?.remember ?? false);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });

  const info = BYOK_PROVIDERS[provider];
  const reason = REASONS[dialogReason];
  const draft: ByokConfig = { provider, model: model.trim(), apiKey: apiKey.trim(), remember };
  const canSave = draft.apiKey.length >= 8;

  const runCheck = async () => {
    setCheck({ status: "checking" });
    try {
      const usedModel = await checkKey(draft);
      setCheck({ status: "ok", message: `Working · ${usedModel}` });
    } catch (err) {
      setCheck({ status: "error", message: err instanceof Error ? err.message : "Key check failed." });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && closeDialog()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-key-title"
        className="rf-card max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 shadow-[6px_6px_0_var(--shadow-color)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-xl border-2 border-line bg-marker text-[#1f1b16]">
              <KeyRound size={18} />
            </div>
            <h2 id="ai-key-title" className="text-lg font-bold tracking-tight text-white">
              {reason.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
            reason.tone === "warn"
              ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
              : "border-white/10 bg-white/[0.03] text-zinc-400"
          }`}
        >
          {reason.body}
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            saveConfig(draft);
            closeDialog();
          }}
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Provider
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p);
                    setCheck({ status: "idle" });
                  }}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    p === provider
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {BYOK_PROVIDERS[p].label.replace("Google ", "")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="byok-key" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                API key
              </label>
              <a
                href={info.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Get your {info.label} key <ExternalLink size={11} />
              </a>
            </div>
            <input
              id="byok-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setCheck({ status: "idle" });
              }}
              placeholder={info.keyPlaceholder}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <label htmlFor="byok-model" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Model <span className="font-normal normal-case tracking-normal text-zinc-600">(optional)</span>
            </label>
            <input
              id="byok-model"
              value={model}
              spellCheck={false}
              onChange={(e) => {
                setModel(e.target.value);
                setCheck({ status: "idle" });
              }}
              placeholder={info.defaultModel}
              className={`${inputClass} font-mono`}
            />
            <p className="mt-1.5 text-[11px] text-zinc-600">Leave blank to use {info.defaultModel}.</p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-blue-600"
            />
            <span>
              Remember on this device
              <span className="block text-xs text-zinc-500">
                Otherwise it&apos;s forgotten when you close this tab.
              </span>
            </span>
          </label>

          {check.status !== "idle" && (
            <p
              className={`flex items-start gap-1.5 text-xs ${
                check.status === "ok" ? "text-green-400" : check.status === "error" ? "text-red-400" : "text-zinc-400"
              }`}
            >
              {check.status === "checking" && <Loader2 size={13} className="mt-0.5 animate-spin" />}
              {check.status === "ok" && <CheckCircle2 size={13} className="mt-0.5" />}
              {check.status === "checking" ? "Checking key…" : check.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSave}
              className="rf-btn rf-btn-primary px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save key
            </button>
            <button
              type="button"
              disabled={!canSave || check.status === "checking"}
              onClick={runCheck}
              className="rf-btn text-sm"
            >
              Test key
            </button>
            {config && (
              <button
                type="button"
                onClick={() => {
                  clearConfig();
                  setApiKey("");
                  setModel("");
                  setCheck({ status: "idle" });
                }}
                className="ml-auto text-sm text-zinc-500 transition hover:text-red-400"
              >
                Remove key
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 flex items-start gap-2 border-t border-white/5 pt-4 text-[11px] leading-relaxed text-zinc-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-zinc-500" />
          Your key stays in this browser. It&apos;s sent with each AI request to ResumeForge&apos;s server, which
          forwards it to {info.label} for that request only, and never stores or logs it. Usage is billed to
          your {info.label} account.
        </p>
      </div>
    </div>
  );
}
