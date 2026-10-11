"use client";

import { KeyRound } from "lucide-react";
import { useAiKeyStore, type AiKeyReason } from "@/store/aiKeyStore";

/** Inline prompt shown where a result degraded because AI was unavailable. */
export default function UseOwnKeyLink({
  reason = "server_exhausted",
  className = "",
}: {
  reason?: AiKeyReason;
  className?: string;
}) {
  const openDialog = useAiKeyStore((s) => s.openDialog);
  const hasKey = useAiKeyStore((s) => s.config !== null);
  return (
    <button
      type="button"
      onClick={() => openDialog(reason)}
      className={`inline-flex items-center gap-1.5 font-semibold text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline ${className}`}
    >
      <KeyRound size={12} />
      {hasKey ? "Check your AI key" : "Use your own API key"}
    </button>
  );
}
