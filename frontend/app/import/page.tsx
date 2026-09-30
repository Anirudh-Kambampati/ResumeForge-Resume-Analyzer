"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useResumeImport, RESUME_ACCEPT_ATTRIBUTE } from "@/lib/useResumeImport";

// ============================================================
// Component
// ============================================================

export default function ImportPage() {
  const router = useRouter();
  const {
    status,
    errorMessage,
    fileName,
    importFile,
    cancel,
    reset,
    inputRef,
    handleFileInputChange,
  } = useResumeImport();

  const [dragOver, setDragOver] = useState(false);

  // Navigate to builder on success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => router.push("/builder"), 1200);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  // Cleanup in-flight requests on unmount
  useEffect(() => {
    return () => cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================================================
  // Drag & drop
  // ==============================================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) importFile(file);
    },
    [importFile],
  );

  // ==============================================================
  // Render
  // ==============================================================

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#09090B] px-6">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-1/3 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>

        {/* Card */}
        <div className="rounded-3xl border border-white/[0.06] bg-[#0C0C0E] p-8 sm:p-10 shadow-xl shadow-black/40">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <Upload size={24} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Import Resume
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Upload an existing PDF or DOCX resume and we&apos;ll
              automatically populate the builder with your content.
            </p>
          </div>

          {/* Drop zone / State */}
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {/* Drag-and-drop zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`
                    group relative cursor-pointer rounded-2xl border-2 border-dashed
                    p-12 text-center transition-all duration-300
                    ${
                      dragOver
                        ? "border-blue-500 bg-blue-500/5"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-blue-500/40 hover:bg-white/[0.04]"
                    }
                  `}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={RESUME_ACCEPT_ATTRIBUTE}
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  <div
                    className={`
                      mx-auto mb-4 flex h-16 w-16 items-center justify-center
                      rounded-2xl transition-all duration-300
                      ${
                        dragOver
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-white/[0.03] text-zinc-500 group-hover:text-blue-400"
                      }
                    `}
                  >
                    <Upload size={28} strokeWidth={1.5} />
                  </div>

                  <p className="text-base font-medium text-zinc-300">
                    {dragOver
                      ? "Drop your resume here"
                      : "Drag & drop your resume here"}
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-600">
                    or click to browse — PDF or DOCX
                  </p>
                </div>

                {/* Features list */}
                <ul className="mt-6 space-y-2.5 text-sm text-zinc-500">
                  {[
                    "Extracts and structures all resume sections",
                    "ATS-friendly formatting applied automatically",
                    "All original content preserved — nothing fabricated",
                    "Redirects to the builder for further editing",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center py-8"
              >
                {/* Animated spinner */}
                <div className="relative mb-6">
                  <div className="h-20 w-20 animate-spin rounded-full border-[3px] border-white/[0.06] border-t-blue-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText size={24} className="text-blue-400" />
                  </div>
                </div>

                <p className="text-base font-medium text-zinc-200">
                  {fileName}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Parsing with AI…
                </p>

                {/* Indeterminate progress bar */}
                <div className="mt-6 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full w-full origin-left animate-[import-progress_2s_ease-in-out_infinite] rounded-full bg-blue-500" />
                </div>

                <button
                  onClick={cancel}
                  className="mt-6 text-sm text-zinc-600 transition-colors hover:text-zinc-400"
                >
                  Cancel
                </button>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center py-8"
              >
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 size={36} className="text-green-400" />
                </div>
                <p className="text-base font-medium text-zinc-200">
                  {fileName}
                </p>
                <p className="mt-1 text-sm text-green-400">
                  Resume parsed successfully!
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Redirecting to builder…
                </p>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center py-8"
              >
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                  <AlertCircle size={36} className="text-red-400" />
                </div>
                <p className="text-base font-medium text-zinc-200">
                  Import failed
                </p>
                <p className="mt-2 max-w-sm text-center text-sm text-red-300">
                  {errorMessage}
                </p>
                <button
                  onClick={reset}
                  className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white"
                >
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-zinc-700">
          Your resume is processed in memory and is never stored on our servers.
        </p>
      </div>

      {/* Inline keyframes for indeterminate progress bar */}
      <style jsx global>{`
        @keyframes import-progress {
          0% { transform: scaleX(0); transform-origin: left; }
          50% { transform: scaleX(1); transform-origin: left; }
          50.01% { transform: scaleX(1); transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </main>
  );
}
