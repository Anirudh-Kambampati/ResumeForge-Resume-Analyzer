"use client";

import { useEffect, useState } from "react";
import ResumePage from "@/components/builder/preview/ResumePage";
import { Resume } from "@/types/resume";

export default function PrintPage() {
  const [resume, setResume] = useState<Resume | null>(null);

  useEffect(() => {
    // Load resume from local storage on mount
    const saved = localStorage.getItem("resumeforge-resume");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setResume(parsed);
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

      // Trigger print dialog after a short delay to ensure rendering
      const timer = setTimeout(() => {
        window.print();
        // Optional: auto-close tab when print dialog is closed or cancelled
        // window.close(); 
      }, 500);

      // Handle after print
      const afterPrint = () => {
        window.close();
      };
      
      window.addEventListener("afterprint", afterPrint);
      
      return () => {
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
      <ResumePage resume={resume} selectedSection={"" as any} />
    </div>
  );
}
