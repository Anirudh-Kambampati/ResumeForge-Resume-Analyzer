"use client";

import { useEffect, useState, useRef } from "react";
import BuilderSidebar from "./BuilderSidebar";
import BuilderTopbar from "./BuilderTopbar";
import BuilderEditor from "./BuilderEditor";
import BuilderPreview from "./BuilderPreview";

import { useResumeStore } from "@/store/resumeStore";

export default function BuilderWorkspace() {
  const {
    resume,
    setResume,
    selectedSection,
    setSelectedSection,
    resetResume,
  } = useResumeStore();

  const [saveStatus, setSaveStatus] = useState<"Saved" | "Saving...">("Saved");
  const isLoaded = useRef(false);

  // 1. Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("resumeforge-resume");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.id) {
          setResume(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved resume from localStorage", e);
      }
    }
    isLoaded.current = true;
  }, [setResume]);

  // 2. Autosave with debounce of 500ms when resume updates
  useEffect(() => {
    if (!isLoaded.current) return;

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
  }, [resume]);

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

          {/* Preview Panel - full width on print */}
          <div className="overflow-auto bg-[#111113] print:bg-white print:overflow-visible print:h-auto">
            <BuilderPreview
              resume={resume}
              selectedSection={selectedSection}
            />
          </div>

        </div>

      </div>

    </main>
  );
}