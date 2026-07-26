"use client";

import { useCallback, useRef, useState } from "react";
import { uploadAndParseResume } from "@/lib/atsImport";
import { useResumeStore } from "@/store/resumeStore";
import type { Resume } from "@/types/resume";

// ============================================================
// Hook state
// ============================================================

export type ImportStatus = "idle" | "loading" | "success" | "error";

export interface UseResumeImportReturn {
  /** Current import status */
  status: ImportStatus;
  /** Human-readable error message when status is "error" */
  errorMessage: string;
  /** Name of the file currently being / that was imported */
  fileName: string;
  /** Accepted MIME types for the file input */
  acceptedFormats: string;
  /** Validate a File and start the import pipeline.
   *  Returns the parsed Resume on success, or null if validation failed. */
  importFile: (file: File) => Promise<Resume | null>;
  /** Abort an in-flight upload and reset to idle */
  cancel: () => void;
  /** Reset status back to "idle" (clear errors) */
  reset: () => void;
  /** Ref for a hidden <input type="file"> — wire this to a button's onClick */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Callback for <input onChange> — extracts the file and calls importFile */
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ============================================================
// Shared validation
// ============================================================

function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files are supported. Please upload a PDF resume.";
  }
  if (file.size === 0) {
    return "The uploaded file is empty. Please select a valid PDF.";
  }
  return null;
}

// ============================================================
// Hook
// ============================================================

export function useResumeImport(): UseResumeImportReturn {
  const setResume = useResumeStore((s) => s.setResume);

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const importFile = useCallback(
    async (file: File): Promise<Resume | null> => {
      // Validate
      const validationError = validateFile(file);
      if (validationError) {
        setStatus("error");
        setErrorMessage(validationError);
        setFileName(file.name);
        return null;
      }

      setFileName(file.name);
      setStatus("loading");
      setErrorMessage("");

      abortRef.current = new AbortController();

      try {
        const resume = await uploadAndParseResume(
          file,
          abortRef.current.signal,
        );
        setResume(resume);
        setStatus("success");
        return resume;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("idle");
          setFileName("");
          return null;
        }
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while parsing your resume.",
        );
        return null;
      }
    },
    [setResume],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setFileName("");
    setErrorMessage("");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage("");
    setFileName("");
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) importFile(file);
      // Reset so re-selecting the same file works
      e.target.value = "";
    },
    [importFile],
  );

  return {
    status,
    errorMessage,
    fileName,
    acceptedFormats: ".pdf",
    importFile,
    cancel,
    reset,
    inputRef,
    handleFileInputChange,
  };
}
