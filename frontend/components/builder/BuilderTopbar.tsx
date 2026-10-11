"use client";

import {
  Download,
  RotateCcw,
  CloudCheck,
  CloudLightning,
  Loader2,
  Menu,
  Sparkles,
  Import,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ResumePDFDocument } from "./preview/ResumePDFDocument";
import { useResumeStore } from "@/store/resumeStore";
import { useResumeImport, RESUME_ACCEPT_ATTRIBUTE } from "@/lib/useResumeImport";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AiKeyButton from "@/components/ai/AiKeyButton";

type Props = {
  resetResume: () => void;
  saveStatus: "Saved" | "Saving...";
  onOpenSidebar?: () => void;
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
  onOpenSidebar,
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
    importMeta,
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
      showToast(
        importMeta && importMeta.ai_review !== "applied"
          ? `"${importFileName}" imported with the rule-based parser (AI review unavailable). Check each section.`
          : `"${importFileName}" imported successfully.`,
        "success",
      );
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
    <header className="flex h-16 items-center justify-between gap-2 border-b-2 border-line bg-app px-3 sm:px-4 lg:px-8">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-6">
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open sections menu"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="hidden sm:block">
          <h2 className="font-serif text-[26px] font-normal leading-none">
            Resume Builder
          </h2>
          <p className="hidden text-sm text-zinc-500 xl:block">
            Build an ATS-friendly resume
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/5 px-3 py-1 text-xs">
          {saveStatus === "Saved" ? (
            <>
              <CloudCheck className="text-green-500" size={14} />
              <span className="hidden text-zinc-400 font-medium sm:inline">Saved</span>
            </>
          ) : (
            <>
              <CloudLightning
                className="text-yellow-500 animate-pulse"
                size={14}
              />
              <span className="hidden text-zinc-400 font-medium sm:inline">Saving...</span>
            </>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <AiKeyButton compact />
        <ThemeToggle />

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
          aria-label="Import resume"
          disabled={importStatus === "loading"}
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border-2
            border-line
            bg-panel
            font-semibold
            shadow-[2px_2px_0_var(--shadow-color)]
            px-2.5
            md:px-4
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
            <Import size={16} />
          )}
          <span className="hidden md:inline">{importStatus === "loading" ? "Importing..." : "Import"}</span>
        </button>

        <button
          onClick={resetResume}
          aria-label="Reset resume"
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border-2
            border-line
            bg-panel
            font-semibold
            shadow-[2px_2px_0_var(--shadow-color)]
            px-2.5
            md:px-4
            py-2
            text-sm
            text-zinc-300
            transition
            hover:bg-white/[0.06]
            hover:text-white
          "
        >
          <RotateCcw size={16} />
          <span className="hidden md:inline">Reset</span>
        </button>

        {onToggleAnalysis && (
          <button
            onClick={onToggleAnalysis}
            aria-label="Analyze resume"
            aria-pressed={analysisOpen}
            className={`
              flex
              items-center
              gap-2
              rounded-xl
              border-2
              font-semibold
              px-2.5
              md:px-4
              py-2
              text-sm
              transition
              ${analysisOpen
                ? "border-line bg-marker text-[#1f1b16] shadow-[2px_2px_0_var(--shadow-color)]"
                : "border-line bg-panel text-zinc-200 shadow-[2px_2px_0_var(--shadow-color)] hover:text-white"}
            `}
          >
            <Sparkles size={16} />
            <span className="hidden md:inline">Analyze</span>
          </button>
        )}

        <button
          onClick={handleDownload}
          aria-label="Download PDF"
          disabled={isDownloading}
          className="
            flex
            items-center
            gap-2
            rf-btn
            rf-btn-primary
            min-h-0
            px-2.5
            md:px-4
            py-2
            text-sm
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          {isDownloading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Download size={16} />
          )}

          <span className="hidden md:inline">{isDownloading ? "Generating..." : "Download PDF"}</span>
        </button>
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </header>
  );
}
