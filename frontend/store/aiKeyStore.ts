"use client";

// ============================================================
// Bring your own key (BYOK)
//
// The user's own AI provider key. Individuals only need it when
// ResumeForge's free AI capacity is used up; ResumeForge for
// Businesses needs it for every AI feature.
//
// Storage: sessionStorage by default (gone when the tab closes), or
// localStorage when the user ticks "Remember on this device". The key
// is sent with each AI request and forwarded to the provider by the
// backend, which never stores it.
// ============================================================

import { create } from "zustand";

export type ByokProvider = "openai" | "anthropic" | "gemini" | "groq" | "openrouter";

export interface ByokProviderInfo {
  label: string;
  /** Suggested model — any model the key can use works */
  defaultModel: string;
  keyUrl: string;
  keyPlaceholder: string;
}

export const BYOK_PROVIDERS: Record<ByokProvider, ByokProviderInfo> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-haiku-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza…",
  },
  groq: {
    label: "Groq",
    defaultModel: "openai/gpt-oss-120b",
    keyUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_…",
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter/auto",
    keyUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-…",
  },
};

/** Why the key dialog was opened — matches the backend's X-AI-Error codes. */
export type AiKeyReason =
  | "server_exhausted"
  | "byok_required"
  | "byok_invalid"
  | "byok_exhausted"
  | "byok_model"
  | "byok_unavailable"
  | "manual";

export interface ByokConfig {
  provider: ByokProvider;
  model: string;
  apiKey: string;
  remember: boolean;
}

const STORAGE_KEY = "resumeforge-byok";

interface AiKeyStore {
  config: ByokConfig | null;
  hydrated: boolean;
  dialogOpen: boolean;
  dialogReason: AiKeyReason;

  hydrate: () => void;
  saveConfig: (config: ByokConfig) => void;
  clearConfig: () => void;
  openDialog: (reason?: AiKeyReason) => void;
  closeDialog: () => void;
}

function isProvider(value: unknown): value is ByokProvider {
  return typeof value === "string" && value in BYOK_PROVIDERS;
}

function readStored(): ByokConfig | null {
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      const raw = storage().getItem(STORAGE_KEY);
      if (!raw) continue;
      const data = JSON.parse(raw) as Partial<ByokConfig>;
      if (isProvider(data.provider) && typeof data.apiKey === "string" && data.apiKey) {
        return {
          provider: data.provider,
          model: typeof data.model === "string" ? data.model : "",
          apiKey: data.apiKey,
          remember: storage() === localStorage,
        };
      }
    } catch {
      // Storage blocked or corrupt — treat as no key
    }
  }
  return null;
}

function writeStored(config: ByokConfig | null) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (config) {
      const target = config.remember ? localStorage : sessionStorage;
      target.setItem(
        STORAGE_KEY,
        JSON.stringify({ provider: config.provider, model: config.model, apiKey: config.apiKey }),
      );
    }
  } catch {
    // Storage blocked: the key still works for this page view
  }
}

export const useAiKeyStore = create<AiKeyStore>((set, get) => ({
  config: null,
  hydrated: false,
  dialogOpen: false,
  dialogReason: "manual",

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ config: readStored(), hydrated: true });
  },

  saveConfig: (config) => {
    const clean = { ...config, apiKey: config.apiKey.trim(), model: config.model.trim() };
    writeStored(clean);
    set({ config: clean, hydrated: true });
  },

  clearConfig: () => {
    writeStored(null);
    set({ config: null, hydrated: true });
  },

  openDialog: (reason = "manual") => set({ dialogOpen: true, dialogReason: reason }),
  closeDialog: () => set({ dialogOpen: false }),
}));

/** The saved config, reading storage on first use (safe outside React). */
export function getByokConfig(): ByokConfig | null {
  const store = useAiKeyStore.getState();
  if (!store.hydrated) store.hydrate();
  return useAiKeyStore.getState().config;
}

export function hasByokKey(): boolean {
  return getByokConfig() !== null;
}

/** Request headers carrying a key to the backend. */
export function byokHeaders(config: ByokConfig | null = getByokConfig()): Record<string, string> {
  if (!config) return {};
  const headers: Record<string, string> = {
    "X-LLM-Provider": config.provider,
    "X-LLM-Key": config.apiKey,
  };
  if (config.model) headers["X-LLM-Model"] = config.model;
  return headers;
}
