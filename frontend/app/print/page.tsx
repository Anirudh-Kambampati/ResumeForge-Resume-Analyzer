"use client";

import { useEffect, useState } from "react";
import ResumePage from "@/components/builder/preview/ResumePage";
import { Resume } from "@/types/resume";
import type { BuilderSection } from "@/store/resumeStore";

/** Minimal Resume stub for the print page — no interactive section needed. */
const PRINT_SECTION = "" as unknown as BuilderSection;

export default function PrintPage() {
  const [resume, setResume] = useState<Resume | null>(null);

  // Load resume from local storage on mount
  // We read localStorage synchronously outside the effect to avoid cascading renders.
  useEffect(() => {
    const saved = localStorage.getItem("resumeforge-resume");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Resume;
        if (parsed && typeof parsed === "object" && parsed.id) {
          setResume(parsed);
        }
      } catch (err) {
        console.error("Failed to parse resume for printing", err);
      }
    }
  }, []);

  useEffect(() => {
    if (resume) {
      // Update document title for the PDF file name
      const name = resume.profile?.fullName || "Resume";
      document.title = `${name.replace(/\s+/g, "-")}-Resume`;

      // Trigger print dialog once the resume fonts have loaded
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancelled = false;
      document.fonts.ready.then(() => {
        if (!cancelled) timer = setTimeout(() => window.print(), 300);
      });

      // Handle after print
      const afterPrint = () => {
        window.close();
      };

      window.addEventListener("afterprint", afterPrint);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        window.removeEventListener("afterprint", afterPrint);
      };
    }
  }, [resume]);

  if (!resume) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-100 text-zinc-500">
        Loading resume for printing...
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-zinc-200 min-h-screen">
      <ResumePage resume={resume} selectedSection={PRINT_SECTION} />
    </div>
  );
}
