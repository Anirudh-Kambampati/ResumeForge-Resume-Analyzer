"use client";

import { useEffect, useState, useRef } from "react";
import BuilderSidebar from "./BuilderSidebar";
import BuilderTopbar from "./BuilderTopbar";
import BuilderEditor from "./BuilderEditor";
import BuilderPreview from "./BuilderPreview";
import AnalysisPanel from "./AnalysisPanel";

import { useResumeStore } from "@/store/resumeStore";
import { getLayoutSections } from "@/config/layouts";
import type { Resume } from "@/types/resume";

/**
 * Ensure every section item in the resume has an enabled field.
 * Catches edge cases where imported data arrives without it.
 */
function ensureEnabledFields(resume: Resume): Resume {
  return {
    ...resume,
    experience: (resume.experience || []).map((e) => ({ ...e, enabled: e.enabled ?? true })),
    education: (resume.education || []).map((e) => ({ ...e, enabled: e.enabled ?? true })),
    projects: (resume.projects || []).map((p) => ({ ...p, enabled: p.enabled ?? true })),
    research: (resume.research || []).map((r: any) => ({ ...r, enabled: r.enabled ?? true })),
    publications: (resume.publications || []).map((p: any) => ({ ...p, enabled: p.enabled ?? true })),
    achievements: (resume.achievements || []).map((a) => ({ ...a, enabled: a.enabled ?? true })),
    certifications: (resume.certifications || []).map((c) => ({ ...c, enabled: c.enabled ?? true })),
    languages: (resume.languages || []).map((l) => ({ ...l, enabled: l.enabled ?? true })),
  };
}

export default function BuilderWorkspace() {
  const {
    resume,
    setResume,
    selectedSection,
    setSelectedSection,
    resetResume,
  } = useResumeStore();

  const [saveStatus, setSaveStatus] = useState<"Saved" | "Saving...">("Saved");
  const [analysisOpen, setAnalysisOpen] = useState(false);

  // Track whether the initial localStorage load has completed.
  // Until it completes, the store may hold stale mock data, so we
  // defer rendering the editor + preview.  This ensures all child
  // useState initializers capture the real imported data on mount.
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // 1. Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("resumeforge-resume");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.id) {
          // Backward compatibility: migrate old fields and ensure defaults
          const patched: Resume = (() => {
            const p = { ...parsed };

            // profile.title (string) → profile.titles (string[])
            if (p.profile) {
              if (typeof p.profile.title === "string" && !Array.isArray(p.profile.titles)) {
                p.profile.titles = p.profile.title.trim() ? [p.profile.title.trim()] : [];
              }
              delete p.profile.title;
            }

            return {
              template: "ats",
              layout: "ats",
              sectionOrder: [...getLayoutSections("ats")],
              ...p,
            };
          })();
          setResume(ensureEnabledFields(patched));
        }
      } catch (e) {
        console.error("Failed to parse saved resume from localStorage", e);
      }
    }
    // Mark load as complete so the editor/preview can mount with
    // the correct data (from localStorage or the store default).
    setInitialLoadDone(true);
  }, [setResume]);

  // 2. Autosave with debounce of 500ms when resume updates
  useEffect(() => {
    if (!initialLoadDone) return;

    setSaveStatus("Saving...");
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem("resumeforge-resume", JSON.stringify(resume));
        setSaveStatus("Saved");
      } catch (e) {
        console.error("Failed to save resume to localStorage", e);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [resume, initialLoadDone]);

  // 3. Show nothing until initial data is ready
  if (!initialLoadDone) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#09090B]">
        <div className="flex items-center gap-3 text-zinc-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
          <span className="text-sm">Loading resume…</span>
        </div>
      </main>
    );
  }

  return (
    <main id="builder-workspace" className="flex h-screen overflow-hidden bg-[#09090B] text-white print:overflow-visible print:h-auto">

      {/* Sidebar - hidden when printing */}
      <div className="print:hidden flex shrink-0">
        <BuilderSidebar
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible print:h-auto">

        {/* Topbar - hidden when printing */}
        <div className="print:hidden">
          <BuilderTopbar
            resetResume={() => {
              if (window.confirm("Are you sure you want to reset your resume to default values? All current progress will be lost.")) {
                resetResume();
                // Ensure local storage is immediately updated
                localStorage.removeItem("resumeforge-resume");
              }
            }}
            saveStatus={saveStatus}
            fullName={resume.profile?.fullName}
            analysisOpen={analysisOpen}
            onToggleAnalysis={() => setAnalysisOpen((open) => !open)}
          />
        </div>

        {/* Workspace Body */}
        <div className="grid flex-1 grid-cols-[480px_1fr] overflow-hidden print:block print:overflow-visible print:h-auto">

          {/* Editor Panel - hidden when printing */}
          <div className="overflow-y-auto border-r border-white/10 bg-[#0C0C0E] print:hidden">
            <BuilderEditor
              resume={resume}
              setResume={setResume}
              selectedSection={selectedSection}
            />
          </div>

          {/* Preview Panel - full width on print. While analysis is open it
              takes over this area on screen, but the preview still prints. */}
          <div
            className={`overflow-auto bg-[#111113] print:block print:bg-white print:overflow-visible print:h-auto ${
              analysisOpen ? "hidden" : ""
            }`}
          >
            <BuilderPreview
              resume={resume}
              selectedSection={selectedSection}
            />
          </div>

          {/* Analysis panel — covers the preview area; kept mounted while closed so results survive */}
          <div className={`overflow-hidden print:hidden ${analysisOpen ? "" : "hidden"}`}>
            <AnalysisPanel onClose={() => setAnalysisOpen(false)} />
          </div>

        </div>

      </div>

    </main>
  );
}