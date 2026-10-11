"use client";

import { useEffect } from "react";
import { KeyRound } from "lucide-react";
import { BYOK_PROVIDERS, useAiKeyStore } from "@/store/aiKeyStore";

/** Header button showing whether a personal AI key is set; opens AI settings. */
export default function AiKeyButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const config = useAiKeyStore((s) => s.config);
  const hydrate = useAiKeyStore((s) => s.hydrate);
  const openDialog = useAiKeyStore((s) => s.openDialog);

  useEffect(() => hydrate(), [hydrate]);

  const label = config ? BYOK_PROVIDERS[config.provider].label.replace("Google ", "") : "AI key";

  return (
    <button
      type="button"
      onClick={() => openDialog("manual")}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-line bg-panel px-2.5 text-sm font-semibold text-white shadow-[2px_2px_0_var(--shadow-color)] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_var(--shadow-color)] ${className}`}
      aria-label={config ? `AI key: ${label}` : "Add your AI key"}
      title={config ? `Using your ${label} key when needed` : "Add your own AI key"}
    >
      <span className="relative">
        <KeyRound size={15} />
        {config && <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-line bg-marker" />}
      </span>
      {!compact && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
