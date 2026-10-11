"use client";

// ============================================================
// ResumeForge for Businesses — screening queues
//
// Each queue is one job opening: a job description, its extracted
// requirements and a batch of resumes. Any number of queues can run at
// once; a shared scheduler hands out work round-robin so one large
// queue can't starve the others:
//   - at most MAX_ACTIVE_PER_QUEUE resumes in flight per queue
//   - at most MAX_ACTIVE_TOTAL in flight overall (backend rate limits)
//   - a 429 puts the resume back in line and pauses dispatch until
//     the server's Retry-After has passed
// AI summaries and briefs use separate, smaller pools.
//
// Results persist in this browser's localStorage (without the resume files:
// those cannot be stored and the backend re-extracts scores server-side from
// text it already returned). Reload restores queues, rankings and briefs;
// "Remove key"-style privacy is honored by the Clear-all affordance on the
// workspace. Closing the tab no longer discards work.
// ============================================================

import { create } from "zustand";
import type {
  Candidate,
  JDRequirements,
  RequirementListKey,
  ScreeningQueue,
} from "@/types/screening";
import {
  MAX_CANDIDATES_PER_QUEUE,
  MAX_RESUME_BYTES,
  extractRequirements,
  fetchCandidateBrief,
  fetchCandidateSummary,
  rankCandidates,
  screenResume,
} from "@/lib/screening";
import { isSupportedResumeFile } from "@/lib/useResumeImport";
import { normalizeError } from "@/lib/errorHelper";
import { ApiError } from "@/lib/api";
import { hasByokKey, useAiKeyStore } from "@/store/aiKeyStore";

export const MAX_ACTIVE_TOTAL = 6;
export const MAX_ACTIVE_PER_QUEUE = 3;
export const MAX_ACTIVE_BRIEFS = 2;
export const MAX_ACTIVE_SUMMARIES = 3;
const DEFAULT_BACKOFF_SECONDS = 10;

const STORAGE_KEY = "resumeforge-screening-v1";

/** A storable snapshot of a queue: everything except candidate File objects. */
export type StoredCandidate = Omit<Candidate, "file"> & { file: null };
export type StoredQueue = Omit<ScreeningQueue, "candidates"> & {
  candidates: StoredCandidate[];
};

function loadPersisted(): { queues: ScreeningQueue[]; selectedQueueId: string | null } {
  if (typeof window === "undefined") return { queues: [], selectedQueueId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { queues: [], selectedQueueId: null };
    const data = JSON.parse(raw) as { queues: StoredQueue[]; selectedQueueId: string | null };
    // Candidation files can't survive a reload; anything still "queued" or mid-screen is
    // dropped — ranked results (status "done") are what persistence is for.
    const queues: ScreeningQueue[] = (data.queues ?? []).map((q) => ({
      ...q,
      status: "paused",
      requirementsStatus: "idle",
      candidates: (q.candidates ?? [])
        .filter((c) => c.status === "done" && c.result)
        .map((c) => ({
          ...c,
          file: null,
          summaryStatus: c.summaryStatus === "loading" || c.summaryStatus === "queued" ? "idle" : c.summaryStatus ?? "idle",
          briefStatus: c.briefStatus === "loading" || c.briefStatus === "queued" ? "idle" : c.briefStatus,
        })),
    }));
    return {
      queues: queues.filter((q) => q.candidates.length > 0 || q.jobDescription || q.requirements),
      selectedQueueId: data.selectedQueueId ?? queues[0]?.id ?? null,
    };
  } catch {
    return { queues: [], selectedQueueId: null }; // corrupt storage — start fresh
  }
}

/** Erase every persisted queue from this browser ("Clear saved" button). */
export function clearPersistedScreening() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked — nothing to clear.
  }
}

/** Serialize current queues for localStorage. Files are replaced by null markers. */
function persist(queues: ScreeningQueue[], selectedQueueId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredQueue[] = queues.map((q) => ({
      ...q,
      status: q.status === "running" ? "paused" : q.status,
      requirementsStatus: q.requirementsStatus === "loading" ? "idle" : q.requirementsStatus,
      candidates: q.candidates.map((c) => ({
        id: c.id,
        file: null,
        fileName: c.fileName,
        size: c.size,
        status: c.status === "screening" ? "queued" : c.status,
        result: c.result,
        error: c.error,
        summaryStatus: c.summaryStatus === "loading" || c.summaryStatus === "queued" ? "idle" : c.summaryStatus,
        aiSummary: c.aiSummary,
        summaryError: c.summaryError,
        briefStatus: c.briefStatus === "loading" || c.briefStatus === "queued" ? "idle" : c.briefStatus,
        brief: c.brief,
        briefError: c.briefError,
      } as StoredCandidate)),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ queues: stored, selectedQueueId }));
  } catch {
    // Storage full or blocked: screening still works, it just won't persist.
  }
}

export interface AddFilesResult {
  added: number;
  skipped: string[];
}

interface ScreeningStore {
  queues: ScreeningQueue[];
  selectedQueueId: string | null;
  /** Epoch ms until which no new screening/brief requests start (after a 429) */
  screenCooldownUntil: number;
  summaryCooldownUntil: number;
  briefCooldownUntil: number;

  /** Client-only: swap in the localStorage snapshot after SSR + hydration. */
  hydrateFromPersisted: () => void;

  createQueue: () => string;
  selectQueue: (id: string) => void;
  removeQueue: (id: string) => void;
  renameQueue: (id: string, name: string) => void;
  setJobDescription: (id: string, jobDescription: string) => void;

  loadRequirements: (id: string) => Promise<void>;
  setTargetTitle: (id: string, title: string) => void;
  addRequirement: (id: string, list: RequirementListKey, value: string) => void;
  removeRequirement: (id: string, list: RequirementListKey, value: string) => void;

  addFiles: (id: string, files: File[]) => AddFilesResult;
  removeCandidate: (queueId: string, candidateId: string) => void;

  startQueue: (id: string) => void;
  pauseQueue: (id: string) => void;
  retryFailed: (id: string) => void;
  rescoreQueue: (id: string) => void;

  requestSummary: (queueId: string, candidateId: string) => void;
  requestBrief: (queueId: string, candidateId: string) => void;
  requestTopBriefs: (queueId: string, count: number) => void;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// In-flight requests, so removing a queue or candidate cancels its work.
const controllers = new Map<string, AbortController>();
let screenTimer: ReturnType<typeof setTimeout> | null = null;
let summaryTimer: ReturnType<typeof setTimeout> | null = null;
let briefTimer: ReturnType<typeof setTimeout> | null = null;
// Rotates which queue gets the next free slot
let roundRobinOffset = 0;

/** ResumeForge's own rate limit (wait and retry) — not the user's provider being out of credit. */
function isServerRateLimit(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 429 && err.aiErrorCode === null;
}

/** Business AI features run on the user's own key; ask for one if missing. */
function requireByokKey(): boolean {
  if (hasByokKey()) return true;
  useAiKeyStore.getState().openDialog("byok_required");
  return false;
}

function abortCandidate(candidateId: string) {
  controllers.get(candidateId)?.abort();
  controllers.delete(candidateId);
  controllers.get(`summary:${candidateId}`)?.abort();
  controllers.delete(`summary:${candidateId}`);
  controllers.get(`brief:${candidateId}`)?.abort();
  controllers.delete(`brief:${candidateId}`);
}

export const useScreeningStore = create<ScreeningStore>((set, get) => {
  // SSR renders with empty state and hydrates from localStorage, which would
  // mismatch the server HTML. Start empty; a hydration effect swaps in the
  // persisted snapshot once render is client-only.
  const persisted = { queues: [], selectedQueueId: null };

  const loadPersistedState = () => {
    const { queues, selectedQueueId } = loadPersisted();
    if (queues.length > 0 || selectedQueueId) {
      set({ queues, selectedQueueId });
    }
  };  const persistQueues = () => {
    const { queues, selectedQueueId } = get();
    persist(queues, selectedQueueId);
  };

  const updateQueue = (id: string, update: (q: ScreeningQueue) => ScreeningQueue) =>
    set((state) => ({ queues: state.queues.map((q) => (q.id === id ? update(q) : q)) }));


  const updateCandidate = (
    queueId: string,
    candidateId: string,
    update: (c: Candidate) => Candidate,
  ) =>
    updateQueue(queueId, (q) => ({
      ...q,
      candidates: q.candidates.map((c) => (c.id === candidateId ? update(c) : c)),
    }));

  const editRequirements = (id: string, edit: (r: JDRequirements) => JDRequirements) =>
    updateQueue(id, (q) =>
      q.requirements
        ? {
            ...q,
            requirements: edit(q.requirements),
            requirementsDirty: q.candidates.some((c) => c.status === "done"),
          }
        : q,
    );

  // ----------------------------------------------------------
  // Screening scheduler
  // ----------------------------------------------------------

  const scheduleScreenPump = (delayMs: number) => {
    if (screenTimer) clearTimeout(screenTimer);
    screenTimer = setTimeout(() => {
      screenTimer = null;
      pumpScreening();
    }, delayMs);
  };

  const pumpScreening = () => {
    const { screenCooldownUntil } = get();
    const wait = screenCooldownUntil - Date.now();
    if (wait > 0) {
      scheduleScreenPump(wait);
      return;
    }

    for (;;) {
      const queues = get().queues.filter((q) => q.status === "running" && q.requirements);
      const totalActive = get().queues.reduce(
        (n, q) => n + q.candidates.filter((c) => c.status === "screening").length,
        0,
      );
      if (totalActive >= MAX_ACTIVE_TOTAL || queues.length === 0) return;

      let started = false;
      for (let i = 0; i < queues.length; i++) {
        const queue = queues[(roundRobinOffset + i) % queues.length];
        const active = queue.candidates.filter((c) => c.status === "screening").length;
        const next = queue.candidates.find((c) => c.status === "queued");
        if (active < MAX_ACTIVE_PER_QUEUE && next) {
          roundRobinOffset = (roundRobinOffset + i + 1) % queues.length;
          startScreening(queue, next);
          started = true;
          break;
        }
      }
      if (!started) return;
    }
  };

  const startScreening = (queue: ScreeningQueue, candidate: Candidate) => {
    const controller = new AbortController();
    controllers.set(candidate.id, controller);
    updateCandidate(queue.id, candidate.id, (c) => ({ ...c, status: "screening", error: undefined }));

    const requirements = queue.requirements!;
    if (!candidate.file) return; // persisted candidates have no file; can't be rescored
    screenResume(candidate.file, requirements, controller.signal)
      .then((result) => {
        // Requirements edited while this was in flight: score it again
        if (get().queues.find((q) => q.id === queue.id)?.requirements !== requirements) {
          updateCandidate(queue.id, candidate.id, (c) => ({ ...c, status: "queued" }));
          return;
        }
        updateCandidate(queue.id, candidate.id, (c) => ({
          ...c,
          status: "done",
          result,
          // A new score invalidates a brief written against the old one
          brief: undefined,
          briefStatus: "idle",
          // …and any summary written against the old score
          aiSummary: undefined,
          summaryError: undefined,
          summaryStatus: hasByokKey() ? "queued" : "idle",
        }));
        // Every screened resume gets a one-line AI take (business BYOK only)
        if (hasByokKey()) pumpSummaries();
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (isServerRateLimit(err)) {
          const seconds = err.retryAfterSeconds ?? DEFAULT_BACKOFF_SECONDS;
          set({ screenCooldownUntil: Date.now() + seconds * 1000 });
          updateCandidate(queue.id, candidate.id, (c) => ({ ...c, status: "queued" }));
          return;
        }
        updateCandidate(queue.id, candidate.id, (c) => ({
          ...c,
          status: "error",
          error: normalizeError(err),
        }));
      })
      .finally(() => {
        if (controllers.get(candidate.id) === controller) controllers.delete(candidate.id);
        pumpScreening();
      });
  };

  // ----------------------------------------------------------
  // Summary scheduler (AI, one line per screened resume)
  // ----------------------------------------------------------

  const scheduleSummaryPump = (delayMs: number) => {
    if (summaryTimer) clearTimeout(summaryTimer);
    summaryTimer = setTimeout(() => {
      summaryTimer = null;
      pumpSummaries();
    }, delayMs);
  };

  const pumpSummaries = () => {
    const wait = get().summaryCooldownUntil - Date.now();
    if (wait > 0) {
      scheduleSummaryPump(wait);
      return;
    }
    for (;;) {
      const all = get().queues.flatMap((q) => q.candidates.map((c) => ({ q, c })));
      const active = all.filter(({ c }) => c.summaryStatus === "loading").length;
      const next = all.find(({ c }) => c.summaryStatus === "queued");
      if (active >= MAX_ACTIVE_SUMMARIES || !next) return;
      startSummary(next.q, next.c);
    }
  };

  const startSummary = (queue: ScreeningQueue, candidate: Candidate) => {
    if (!candidate.result || !queue.requirements) {
      updateCandidate(queue.id, candidate.id, (c) => ({ ...c, summaryStatus: "idle" }));
      return;
    }
    const key = `summary:${candidate.id}`;
    const controller = new AbortController();
    controllers.set(key, controller);
    updateCandidate(queue.id, candidate.id, (c) => ({ ...c, summaryStatus: "loading", summaryError: undefined }));

    fetchCandidateSummary(queue, candidate.result, controller.signal)
      .then((summary) => {
        updateCandidate(queue.id, candidate.id, (c) => ({ ...c, aiSummary: summary, summaryStatus: "done" }));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (isServerRateLimit(err)) {
          const seconds = err.retryAfterSeconds ?? DEFAULT_BACKOFF_SECONDS;
          set({ summaryCooldownUntil: Date.now() + seconds * 1000 });
          updateCandidate(queue.id, candidate.id, (c) => ({ ...c, summaryStatus: "queued" }));
          return;
        }
        updateCandidate(queue.id, candidate.id, (c) => ({
          ...c,
          summaryStatus: "error",
          summaryError: normalizeError(err),
        }));
      })
      .finally(() => {
        if (controllers.get(key) === controller) controllers.delete(key);
        pumpSummaries();
      });
  };

  /** Queue a summary without prompting for a key (the auto path checks hasByokKey first). */
  const queueSummary = (queueId: string, candidateId: string) => {
    updateCandidate(queueId, candidateId, (c) =>
      c.result && c.summaryStatus !== "loading" && c.summaryStatus !== "queued"
        ? { ...c, summaryStatus: "queued", summaryError: undefined }
        : c,
    );
    pumpSummaries();
  };

  // ----------------------------------------------------------
  // Brief scheduler (AI, smaller pool)
  // ----------------------------------------------------------

  const scheduleBriefPump = (delayMs: number) => {
    if (briefTimer) clearTimeout(briefTimer);
    briefTimer = setTimeout(() => {
      briefTimer = null;
      pumpBriefs();
    }, delayMs);
  };

  const pumpBriefs = () => {
    const wait = get().briefCooldownUntil - Date.now();
    if (wait > 0) {
      scheduleBriefPump(wait);
      return;
    }
    for (;;) {
      const all = get().queues.flatMap((q) => q.candidates.map((c) => ({ q, c })));
      const active = all.filter(({ c }) => c.briefStatus === "loading").length;
      const next = all.find(({ c }) => c.briefStatus === "queued");
      if (active >= MAX_ACTIVE_BRIEFS || !next) return;
      startBrief(next.q, next.c);
    }
  };

  const startBrief = (queue: ScreeningQueue, candidate: Candidate) => {
    if (!candidate.result || !queue.requirements) {
      updateCandidate(queue.id, candidate.id, (c) => ({ ...c, briefStatus: "idle" }));
      return;
    }
    const key = `brief:${candidate.id}`;
    const controller = new AbortController();
    controllers.set(key, controller);
    updateCandidate(queue.id, candidate.id, (c) => ({ ...c, briefStatus: "loading", briefError: undefined }));

    fetchCandidateBrief(queue, candidate.result, controller.signal)
      .then((brief) => {
        updateCandidate(queue.id, candidate.id, (c) => ({ ...c, brief, briefStatus: "done" }));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (isServerRateLimit(err)) {
          const seconds = err.retryAfterSeconds ?? DEFAULT_BACKOFF_SECONDS;
          set({ briefCooldownUntil: Date.now() + seconds * 1000 });
          updateCandidate(queue.id, candidate.id, (c) => ({ ...c, briefStatus: "queued" }));
          return;
        }
        updateCandidate(queue.id, candidate.id, (c) => ({
          ...c,
          briefStatus: "error",
          briefError: normalizeError(err),
        }));
      })
      .finally(() => {
        if (controllers.get(key) === controller) controllers.delete(key);
        pumpBriefs();
      });
  };

  return {
    queues: persisted.queues,
    selectedQueueId: persisted.selectedQueueId,
    screenCooldownUntil: 0,
    summaryCooldownUntil: 0,
    briefCooldownUntil: 0,

    /** Client-only: swap in the localStorage snapshot after SSR + hydration. */
    hydrateFromPersisted: loadPersistedState,

    createQueue: () => {
      const id = newId();
      const count = get().queues.length + 1;
      const queue: ScreeningQueue = {
        id,
        name: `Opening ${count}`,
        jobDescription: "",
        requirements: null,
        requirementsStatus: "idle",
        requirementsDirty: false,
        status: "draft",
        candidates: [],
        createdAt: Date.now(),
      };
      set((state) => ({ queues: [...state.queues, queue], selectedQueueId: id }));
      persistQueues();
      return id;
    },

    selectQueue: (selectedQueueId) => {
      set({ selectedQueueId });
      persistQueues();
    },

    removeQueue: (id) => {
      const queue = get().queues.find((q) => q.id === id);
      queue?.candidates.forEach((c) => abortCandidate(c.id));
      set((state) => {
        const queues = state.queues.filter((q) => q.id !== id);
        return {
          queues,
          selectedQueueId:
            state.selectedQueueId === id ? (queues[queues.length - 1]?.id ?? null) : state.selectedQueueId,
        };
      });
      persistQueues();
      pumpScreening();
      pumpSummaries();
      pumpBriefs();
    },

    renameQueue: (id, name) => updateQueue(id, (q) => ({ ...q, name })),

    setJobDescription: (id, jobDescription) => updateQueue(id, (q) => ({ ...q, jobDescription })),

    loadRequirements: async (id) => {
      const queue = get().queues.find((q) => q.id === id);
      if (!queue || !requireByokKey()) return;
      updateQueue(id, (q) => ({ ...q, requirementsStatus: "loading", requirementsError: undefined }));
      try {
        const requirements = await extractRequirements(queue.jobDescription.trim());
        updateQueue(id, (q) => ({
          ...q,
          requirements,
          requirementsStatus: "idle",
          requirementsDirty: q.candidates.some((c) => c.status === "done"),
          name:
            /^Opening \d+$/.test(q.name) && requirements.target_title
              ? requirements.target_title
              : q.name,
        }));
      } catch (err) {
        updateQueue(id, (q) => ({
          ...q,
          requirementsStatus: "error",
          requirementsError: normalizeError(err),
        }));
      }
    },

    setTargetTitle: (id, title) =>
      editRequirements(id, (r) => ({ ...r, target_title: title })),

    addRequirement: (id, list, value) => {
      const item = list === "responsibilities" ? value.trim() : value.trim().toLowerCase();
      if (!item) return;
      editRequirements(id, (r) =>
        r[list].includes(item) ? r : { ...r, [list]: [...r[list], item] },
      );
    },

    removeRequirement: (id, list, value) =>
      editRequirements(id, (r) => ({ ...r, [list]: r[list].filter((x) => x !== value) })),

    addFiles: (id, files) => {
      const queue = get().queues.find((q) => q.id === id);
      const result: AddFilesResult = { added: 0, skipped: [] };
      if (!queue) return result;

      const seen = new Set(queue.candidates.map((c) => `${c.fileName}:${c.size}`));
      const fresh: Candidate[] = [];
      for (const file of files) {
        const key = `${file.name}:${file.size}`;
        if (!isSupportedResumeFile(file.name)) {
          result.skipped.push(`${file.name} (not PDF/DOCX)`);
        } else if (file.size > MAX_RESUME_BYTES) {
          result.skipped.push(`${file.name} (over 5MB)`);
        } else if (seen.has(key)) {
          result.skipped.push(`${file.name} (already added)`);
        } else if (queue.candidates.length + fresh.length >= MAX_CANDIDATES_PER_QUEUE) {
          result.skipped.push(`${file.name} (queue limit of ${MAX_CANDIDATES_PER_QUEUE} reached)`);
        } else {
          seen.add(key);
          fresh.push({
            id: newId(),
            file,
            fileName: file.name,
            size: file.size,
            status: "queued",
            summaryStatus: "idle",
            briefStatus: "idle",
          });
        }
      }
      result.added = fresh.length;
      if (fresh.length) {
        updateQueue(id, (q) => ({ ...q, candidates: [...q.candidates, ...fresh] }));
        pumpScreening();
      }
      return result;
    },

    removeCandidate: (queueId, candidateId) => {
      abortCandidate(candidateId);
      updateQueue(queueId, (q) => ({
        ...q,
        candidates: q.candidates.filter((c) => c.id !== candidateId),
      }));
      pumpScreening();
      pumpSummaries();
      pumpBriefs();
    },

    startQueue: (id) => {
      updateQueue(id, (q) => (q.requirements ? { ...q, status: "running" } : q));
      pumpScreening();
    },

    pauseQueue: (id) => updateQueue(id, (q) => ({ ...q, status: "paused" })),

    retryFailed: (id) => {
      updateQueue(id, (q) => ({
        ...q,
        candidates: q.candidates.map((c) =>
          c.status === "error" ? { ...c, status: "queued", error: undefined } : c,
        ),
      }));
      pumpScreening();
    },

    rescoreQueue: (id) => {
      updateQueue(id, (q) => ({
        ...q,
        requirementsDirty: false,
        candidates: q.candidates.map((c) =>
          c.status === "done" || c.status === "error"
            ? { ...c, status: "queued", error: undefined }
            : c,
        ),
      }));
      pumpScreening();
    },

    requestSummary: (queueId, candidateId) => {
      if (!requireByokKey()) return;
      queueSummary(queueId, candidateId);
    },

    requestBrief: (queueId, candidateId) => {
      if (!requireByokKey()) return;
      updateCandidate(queueId, candidateId, (c) =>
        c.result && c.briefStatus !== "loading"
          ? { ...c, briefStatus: "queued", briefError: undefined }
          : c,
      );
      pumpBriefs();
    },

    requestTopBriefs: (queueId, count) => {
      const queue = get().queues.find((q) => q.id === queueId);
      if (!queue || !requireByokKey()) return;
      const top = rankCandidates(queue.candidates)
        .filter((c) => c.status === "done")
        .slice(0, count)
        .filter((c) => c.briefStatus === "idle" || c.briefStatus === "error")
        .map((c) => c.id);
      const wanted = new Set(top);
      updateQueue(queueId, (q) => ({
        ...q,
        candidates: q.candidates.map((c) =>
          wanted.has(c.id) ? { ...c, briefStatus: "queued", briefError: undefined } : c,
        ),
      }));
      pumpBriefs();
    },
  };
});

// Persist after every store change. A subscription (instead of per-set calls)
// keeps one owner for storage writes and can't be bypassed by a new code path.
if (typeof window !== "undefined") {
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  useScreeningStore.subscribe((state) => {
    if (persistTimer) return;
    // Coalesce bursts (a screening round updates many candidates quickly).
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persist(state.queues, state.selectedQueueId);
    }, 250);
  });
}
