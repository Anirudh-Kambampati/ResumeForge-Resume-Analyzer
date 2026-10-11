// ============================================================
// ResumeForge for Businesses — API calls and helpers
// ============================================================

import { API_BASE_URL, apiHeaders, toApiError } from "@/lib/api";
import type {
  Candidate,
  CandidateBrief,
  JDRequirements,
  ScreenResult,
  ScreeningQueue,
} from "@/types/screening";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_CANDIDATES_PER_QUEUE = 200;
export const MIN_JOB_DESCRIPTION_CHARS = 50;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export async function extractRequirements(jobDescription: string): Promise<JDRequirements> {
  const data = await request<{ jd_requirements: JDRequirements }>("/api/business/requirements", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ job_description: jobDescription }),
  });
  return data.jd_requirements;
}

export function screenResume(
  file: File,
  requirements: JDRequirements,
  signal?: AbortSignal,
): Promise<ScreenResult> {
  const form = new FormData();
  form.append("resume", file);
  form.append("jd_requirements", JSON.stringify(requirements));
  // No Content-Type header — the browser sets the multipart boundary.
  return request<ScreenResult>("/api/business/screen", {
    method: "POST",
    headers: apiHeaders(),
    body: form,
    signal,
  });
}

/** One-sentence AI take for the screening table's summary column. */
export function fetchCandidateSummary(
  queue: ScreeningQueue,
  result: ScreenResult,
  signal?: AbortSignal,
): Promise<string> {
  return request<{ summary: string }>("/api/business/summary", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      resume_text: result.resume_text,
      job_description: queue.jobDescription,
      jd_requirements: queue.requirements,
      match_score: result.match_score,
      missing_keywords: result.missing_keywords,
    }),
    signal,
  }).then((data) => data.summary);
}

export function fetchCandidateBrief(
  queue: ScreeningQueue,
  result: ScreenResult,
  signal?: AbortSignal,
): Promise<CandidateBrief> {
  return request<CandidateBrief>("/api/business/brief", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      resume_text: result.resume_text,
      job_description: queue.jobDescription,
      jd_requirements: queue.requirements,
      match_score: result.match_score,
      missing_keywords: result.missing_keywords,
    }),
    signal,
  });
}

// ------------------------------------------------------------
// Ranking & display helpers
// ------------------------------------------------------------

export function candidateDisplayName(candidate: Candidate): string {
  return candidate.result?.candidate.name || candidate.fileName.replace(/\.(pdf|docx)$/i, "");
}

/** Scored candidates by match score (ties: more required skills, then ATS score); the rest after. */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  const scored = candidates.filter((c) => c.status === "done" && c.result);
  const others = candidates.filter((c) => !(c.status === "done" && c.result));
  scored.sort((a, b) => {
    const ra = a.result!;
    const rb = b.result!;
    return (
      rb.match_score - ra.match_score ||
      rb.required_skills.matched.length - ra.required_skills.matched.length ||
      rb.ats_score - ra.ats_score ||
      a.fileName.localeCompare(b.fileName)
    );
  });
  return [...scored, ...others];
}

export interface QueueProgress {
  total: number;
  done: number;
  failed: number;
  active: number;
  pending: number;
}

export function queueProgress(queue: ScreeningQueue): QueueProgress {
  const p: QueueProgress = { total: queue.candidates.length, done: 0, failed: 0, active: 0, pending: 0 };
  for (const c of queue.candidates) {
    if (c.status === "done") p.done++;
    else if (c.status === "error") p.failed++;
    else if (c.status === "screening") p.active++;
    else p.pending++;
  }
  return p;
}

export function scoreTone(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

/** Round score sticker classes (globals.css .rf-score): marker 75+, paper 50–74, red pencil below. */
export function scoreSticker(score: number): string {
  if (score >= 75) return "rf-score rf-score--good -rotate-6";
  if (score >= 50) return "rf-score rotate-3";
  return "rf-score rf-score--low rotate-6";
}

// ------------------------------------------------------------
// CSV export
// ------------------------------------------------------------

function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  // Neutralise spreadsheet formula injection from resume-derived text
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function queueToCsv(queue: ScreeningQueue): string {
  const header = [
    "Rank",
    "Candidate",
    "Email",
    "File",
    "Match score",
    "Required skills matched",
    "Required skills missing",
    "Preferred skills matched",
    "ATS score",
    "Status",
    "AI summary",
    "AI brief",
  ];
  let rank = 0;
  const rows = rankCandidates(queue.candidates).map((c) => {
    const r = c.result;
    return [
      r ? ++rank : "",
      candidateDisplayName(c),
      r?.candidate.email ?? "",
      c.fileName,
      r?.match_score ?? "",
      r ? `${r.required_skills.matched.length}/${r.required_skills.matched.length + r.required_skills.missing.length}` : "",
      r?.required_skills.missing.join("; ") ?? "",
      r?.preferred_skills.matched.join("; ") ?? "",
      r?.ats_score ?? "",
      c.status === "error" ? `Error: ${c.error ?? ""}` : c.status,
      c.aiSummary ?? "",
      c.brief?.summary ?? "",
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** The best AI text for a candidate: the full brief's summary, else the one-line table summary. */
export function candidateAiTake(candidate: Candidate): { source: "brief" | "summary" | null; text: string } {
  if (candidate.briefStatus === "done" && candidate.brief?.summary) return { source: "brief", text: candidate.brief.summary };
  if (candidate.aiSummary) return { source: "summary", text: candidate.aiSummary };
  return { source: null, text: "" };
}

export function exportFileName(queue: ScreeningQueue, extension: string): string {
  return `${queue.name.replace(/[^\w\- ]+/g, "").trim() || "screening"}.${extension}`;
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(queue: ScreeningQueue): void {
  // BOM so Excel opens UTF-8 names correctly
  saveBlob(new Blob(["﻿" + queueToCsv(queue)], { type: "text/csv;charset=utf-8" }), exportFileName(queue, "csv"));
}
