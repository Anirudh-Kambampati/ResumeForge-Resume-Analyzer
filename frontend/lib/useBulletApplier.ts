"use client";

// ============================================================
// Apply analyzer rewrites to a builder copy of the analyzed resume
//
// The analyzer only has the uploaded file and text pairs
// ({ original, improved }). To preview a rewrite in place, the file is
// imported into a builder Resume once (not saved — the builder's own
// resume is untouched until the user chooses "Open in builder"), then
// each original is located by normalized text and replaced.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Resume } from "@/types/resume";
import { parseResumeFile } from "@/lib/atsImport";
import { locateText, readText, writeText, type ImprovedBullet, type TextLocation } from "@/lib/analysis";
import { normalizeError } from "@/lib/errorHelper";

export type ApplierStatus = "idle" | "loading" | "ready" | "error";

/** Per-rewrite state: applied (with where), or not found in the parsed resume. */
export type BulletState =
  | { kind: "pending" }
  | { kind: "applied"; loc: TextLocation; previous: string }
  | { kind: "missing" };

export interface BulletApplier {
  status: ApplierStatus;
  error: string | null;
  /** The resume with every applied rewrite; null until loaded */
  resume: Resume | null;
  states: Record<number, BulletState>;
  /** Where the most recent change landed, for highlighting the preview */
  lastLocation: TextLocation | null;
  appliedCount: number;
  load: () => void;
  apply: (index: number) => void;
  applyAll: () => void;
  undo: (index: number) => void;
}

export function useBulletApplier(file: File | null, bullets: ImprovedBullet[]): BulletApplier {
  const [status, setStatus] = useState<ApplierStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [states, setStates] = useState<Record<number, BulletState>>({});
  const [lastLocation, setLastLocation] = useState<TextLocation | null>(null);
  // Rewrites requested before the resume finished loading
  const queued = useRef<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const load = useCallback(() => {
    if (!file || status === "loading" || status === "ready") return;
    abortRef.current = new AbortController();
    setStatus("loading");
    setError(null);
    parseResumeFile(file, abortRef.current.signal)
      .then(({ resume: parsed }) => {
        setResume(parsed);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(normalizeError(err));
        setStatus("error");
      });
  }, [file, status]);

  /** Apply one rewrite to `current`; returns the new resume and that rewrite's state. */
  const applyTo = useCallback(
    (current: Resume, index: number): [Resume, BulletState] => {
      const bullet = bullets[index];
      if (!bullet) return [current, { kind: "missing" }];
      const loc = locateText(current, bullet.original);
      if (!loc) return [current, { kind: "missing" }];
      const previous = readText(current, loc) ?? bullet.original;
      return [writeText(current, loc, bullet.improved), { kind: "applied", loc, previous }];
    },
    [bullets],
  );

  const applyMany = useCallback(
    (indexes: number[]) => {
      if (!resume) return;
      let next = resume;
      const updates: Record<number, BulletState> = {};
      let last: TextLocation | null = null;
      for (const index of indexes) {
        if (states[index]?.kind === "applied") continue;
        const [updated, state] = applyTo(next, index);
        next = updated;
        updates[index] = state;
        if (state.kind === "applied") last = state.loc;
      }
      setResume(next);
      setStates((prev) => ({ ...prev, ...updates }));
      if (last) setLastLocation(last);
    },
    [resume, states, applyTo],
  );

  // Flush rewrites that were requested while the resume was loading
  useEffect(() => {
    if (status !== "ready" || queued.current.size === 0) return;
    const pending = [...queued.current];
    queued.current.clear();
    applyMany(pending);
  }, [status, applyMany]);

  const apply = useCallback(
    (index: number) => {
      if (status !== "ready") {
        queued.current.add(index);
        load();
        return;
      }
      applyMany([index]);
    },
    [status, load, applyMany],
  );

  const applyAll = useCallback(() => {
    const all = bullets.map((_, i) => i);
    if (status !== "ready") {
      all.forEach((i) => queued.current.add(i));
      load();
      return;
    }
    applyMany(all);
  }, [bullets, status, load, applyMany]);

  const undo = useCallback(
    (index: number) => {
      const state = states[index];
      const bullet = bullets[index];
      if (!resume || !bullet || state?.kind !== "applied") return;
      // Only restore if the text is still the rewrite (nothing else changed it)
      if (readText(resume, state.loc) === bullet.improved) {
        setResume(writeText(resume, state.loc, state.previous));
        setLastLocation(state.loc);
      }
      setStates((prev) => ({ ...prev, [index]: { kind: "pending" } }));
    },
    [resume, states, bullets],
  );

  const appliedCount = Object.values(states).filter((s) => s.kind === "applied").length;

  return { status, error, resume, states, lastLocation, appliedCount, load, apply, applyAll, undo };
}
