"use client";

import {
  Download,
  RotateCcw,
  CloudCheck,
  CloudLightning,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ResumePDFDocument } from "./preview/ResumePDFDocument";
import { useResumeStore } from "@/store/resumeStore";
import { useResumeImport, RESUME_ACCEPT_ATTRIBUTE } from "@/lib/useResumeImport";

type Props = {
  resetResume: () => void;
  saveStatus: "Saved" | "Saving...";
  fullName?: string;
  analysisOpen?: boolean;
  onToggleAnalysis?: () => void;
};

// ============================================================
// Simple inline toast — uses global CSS animation classes.
// ============================================================

function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      className={`toast-slide-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-xl ${
        type === "success"
          ? "border-green-500/20 bg-green-500/10 text-green-300"
          : "border-red-500/20 bg-red-500/10 text-red-300"
      }`}
    >
      {type === "success" ? (
        <CloudCheck size={16} className="shrink-0" />
      ) : (
        <CloudLightning size={16} className="shrink-0" />
      )}
      {message}
    </div>
  );
}

export default function BuilderTopbar({
  resetResume,
  saveStatus,
  fullName,
  analysisOpen = false,
  onToggleAnalysis,
}: Props) {
  const resume = useResumeStore((state) => state.resume);

  const [isDownloading, setIsDownloading] = useState(false);

  // Shared import hook — handles file validation, upload, and store update
  const {
    status: importStatus,
    fileName: importFileName,
    errorMessage: importError,
    importFile,
    reset: resetImport,
    inputRef,
    handleFileInputChange,
  } = useResumeImport();

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    key: number;
  } | null>(null);
  const toastKeyRef = useRef(0);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      toastKeyRef.current += 1;
      setToast({ message, type, key: toastKeyRef.current });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  // React to import status changes and show toasts
  const prevStatusRef = useRef(importStatus);
  if (importStatus !== prevStatusRef.current) {
    prevStatusRef.current = importStatus;
    if (importStatus === "success") {
      showToast(`"${importFileName}" imported successfully.`, "success");
    } else if (importStatus === "error") {
      showToast(importError || "Import failed. Please try again.", "error");
    }
  }

  const handleImportClick = useCallback(() => {
    // Confirm if user has existing content
    const hasContent =
      resume.profile?.fullName ||
      resume.experience?.length > 0 ||
      resume.education?.length > 0;

    if (
      hasContent &&
      !window.confirm(
        "Importing a new resume will replace all current content. Continue?",
      )
    ) {
      return;
    }

    // Reset previous import state before opening file picker
    resetImport();
    inputRef.current?.click();
  }, [resume, resetImport, inputRef]);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      const pdfBlob = await pdf(
        <ResumePDFDocument resume={resume} />,
      ).toBlob();

      const safeName = (fullName || "Resume")
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, "_");

      // IE / Legacy Edge fallback
      if ((window.navigator as any).msSaveOrOpenBlob) {
        (window.navigator as any).msSaveOrOpenBlob(
          pdfBlob,
          `${safeName}.pdf`,
        );
        return;
      }

      // Wrap the PDF blob as a generic binary blob to prevent
      // Chrome's inline PDF viewer from intercepting the download.
      const downloadBlob = new Blob([pdfBlob], {
        type: "application/octet-stream",
      });

      const url = URL.createObjectURL(downloadBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.pdf`;
      link.style.display = "none";

      document.body.appendChild(link);

      requestAnimationFrame(() => {
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#09090B] px-8">
      {/* Left */}
      <div className="flex items-center gap-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Resume Builder
          </h2>
          <p className="text-sm text-zinc-500">
            Build an ATS-friendly resume
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/5 px-3 py-1 text-xs">
          {saveStatus === "Saved" ? (
            <>
              <CloudCheck className="text-green-500" size={14} />
              <span className="text-zinc-400 font-medium">Saved</span>
            </>
          ) : (
            <>
              <CloudLightning
                className="text-yellow-500 animate-pulse"
                size={14}
              />
              <span className="text-zinc-400 font-medium">Saving...</span>
            </>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Hidden file input — wired through the shared hook */}
        <input
          ref={inputRef}
          type="file"
          accept={RESUME_ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Import button */}
        <button
          onClick={handleImportClick}
          disabled={importStatus === "loading"}
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-white/10
            bg-white/[0.03]
            px-4
            py-2
            text-sm
            text-zinc-300
            transition
            hover:bg-white/[0.06]
            hover:text-white
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          {importStatus === "loading" ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Upload size={16} />
          )}
          {importStatus === "loading" ? "Importing..." : "Import"}
        </button>

        <button
          onClick={resetResume}
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-white/10
            bg-white/[0.03]
            px-4
            py-2
            text-sm
            text-zinc-300
            transition
            hover:bg-white/[0.06]
            hover:text-white
          "
        >
          <RotateCcw size={16} />
          Reset
        </button>

        {onToggleAnalysis && (
          <button
            onClick={onToggleAnalysis}
            aria-pressed={analysisOpen}
            className={`
              flex
              items-center
              gap-2
              rounded-xl
              border
              px-4
              py-2
              text-sm
              transition
              ${analysisOpen
                ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white"}
            `}
          >
            <Sparkles size={16} />
            Analyze
          </button>
        )}

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="
            flex
            items-center
            gap-2
            rounded-xl
            bg-blue-600
            px-4
            py-2
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-blue-500
            shadow-lg
            shadow-blue-600/10
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          {isDownloading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Download size={16} />
          )}

          {isDownloading ? "Generating..." : "Download PDF"}
        </button>
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </header>
  );
}
