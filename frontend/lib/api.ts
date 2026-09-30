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

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Build headers for API requests. Includes X-Api-Key when configured.
 */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const secret = process.env.NEXT_PUBLIC_API_SECRET_KEY;
  const headers: Record<string, string> = { ...extra };
  if (secret) {
    headers["X-Api-Key"] = secret;
  }
  return headers;
}

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
 * Convert a failed Response into an Error carrying the server's detail.
 */
export async function toApiError(response: Response): Promise<Error> {
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
  return new Error(detail);
}
