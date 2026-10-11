// ============================================================
// Shared API client for the ResumeForge backend.
//
// Single source of truth for:
//   - the backend base URL (NEXT_PUBLIC_API_URL)
//   - the optional shared-secret header (X-Api-Key)
//
// The backend enables X-Api-Key checks only when its API_SECRET_KEY
// env var is set, so local development works with zero configuration.
// ============================================================

import { byokHeaders, useAiKeyStore, type AiKeyReason } from "@/store/aiKeyStore";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Build headers for API requests. Includes X-Api-Key when configured, and
 * the user's own AI key (BYOK) when they saved one — the backend decides per
 * feature whether to use it.
 */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const secret = process.env.NEXT_PUBLIC_API_SECRET_KEY;
  const headers: Record<string, string> = {
    ...(typeof window !== "undefined" ? byokHeaders() : {}),
    ...extra,
  };
  if (secret) {
    headers["X-Api-Key"] = secret;
  }
  return headers;
}

/** Backend X-AI-Error codes (see backend/services/llm_client.py). */
export type AiErrorCode =
  | "server_exhausted"
  | "byok_required"
  | "byok_invalid"
  | "byok_exhausted"
  | "byok_model"
  | "byok_unavailable";

/** A failed API call, with what the UI needs to react to it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly aiErrorCode: AiErrorCode | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

// Codes where the user's own key would fix things: open AI settings.
const KEY_DIALOG_CODES: ReadonlySet<string> = new Set([
  "server_exhausted",
  "byok_required",
  "byok_invalid",
  "byok_exhausted",
  "byok_model",
]);

/**
 * POST JSON to a backend endpoint and return the parsed response.
 * Throws Error with the server-provided detail on non-2xx responses.
 */
export async function apiPostJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

/**
 * POST a multipart FormData (e.g. PDF upload) and return the parsed response.
 * Throws Error with the server-provided detail on non-2xx responses.
 */
export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  signal?: AbortSignal,
): Promise<T> {
  // No Content-Type header — the browser sets the multipart boundary.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    headers: apiHeaders(),
    signal,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

/**
 * Convert a failed Response into an ApiError carrying the server's detail.
 * When the failure is one the user's own AI key would fix, AI settings open.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  let detail = `Request failed with status ${response.status}.`;
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    detail = retryAfter
      ? `Too many requests. Please wait ${retryAfter}s and try again.`
      : "Too many requests. Please wait a moment and try again.";
  }
  try {
    const text = await response.text();
    if (text) {
      try {
        const data: unknown = JSON.parse(text);
        if (
          data &&
          typeof data === "object" &&
          "detail" in data &&
          typeof (data as { detail: unknown }).detail === "string"
        ) {
          detail = (data as { detail: string }).detail;
        }
      } catch {
        detail = text;
      }
    }
  } catch {
    // keep default detail
  }
  const code = response.headers.get("x-ai-error");
  const retryAfter = Number(response.headers.get("retry-after"));
  if (code && KEY_DIALOG_CODES.has(code) && typeof window !== "undefined") {
    useAiKeyStore.getState().openDialog(code as AiKeyReason);
  }
  return new ApiError(
    detail,
    response.status,
    (code as AiErrorCode | null) || null,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  );
}
