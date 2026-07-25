"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useResumeStore } from "@/store/resumeStore";
import { mapParsedResumeToBuilderData } from "@/utils/mapParsedResume";
import type { ParsedResume } from "@/utils/mapParsedResume";
import { normalizeError } from "@/lib/errorHelper";

export default function ImportResumeButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setResume, setSelectedSection } = useResumeStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setSuccess(false);
    setToastMessage(null);

    // Validate
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF resume files are supported.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Resume file size must be less than 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBase}/api/parse`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Parsing failed with status ${response.status}.`;
        try {
          const errorData: unknown = JSON.parse(errorText);
          errorMessage = normalizeError(errorData);
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const parsedData: ParsedResume = await response.json();

      // Debug: log header-specific data before full mapping
      const profileRaw = parsedData.profile || {};
      console.log("[Import] Detected Header:", JSON.stringify({
        name: profileRaw.fullName || "",
        email: profileRaw.email || "",
        phone: profileRaw.phone || "",
        github: profileRaw.github || "",
        linkedin: profileRaw.linkedin || "",
        portfolio: profileRaw.portfolio || "",
        location: profileRaw.location || "",
      }, null, 2));

      const newResume = mapParsedResumeToBuilderData(parsedData);

      console.log("[Import] Final ResumeData:", JSON.stringify(newResume, null, 2));

      setResume(newResume);
      setSelectedSection("Profile");

      setSuccess(true);
      setToastMessage("Resume imported successfully.");
    } catch (e: unknown) {
      console.error(e);
      let errMsg = "An unexpected error occurred while importing the resume.";
      if (e instanceof Error) {
        if (
          e.name === "TypeError" &&
          (e.message.toLowerCase().includes("fetch") ||
            e.message.toLowerCase().includes("network"))
        ) {
          errMsg =
            "Could not connect to the server. Make sure the backend is running.";
        } else {
          errMsg = e.message;
        }
      } else {
        errMsg = normalizeError(e);
      }
      setError(errMsg);
    } finally {
      setLoading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        className="hidden"
      />

      <button
        onClick={handleClick}
        disabled={loading}
        className="
          flex
          items-center
          gap-2
          rounded-xl
          border
          border-blue-500/30
          bg-blue-500/5
          px-4
          py-2
          text-sm
          text-blue-400
          transition
          hover:bg-blue-500/15
          hover:text-blue-300
          disabled:opacity-50
          disabled:cursor-not-allowed
        "
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Importing...
          </>
        ) : (
          <>
            <Upload size={16} />
            Import Resume
          </>
        )}
      </button>

      {/* Global toast container — bottom-left */}
      {toastMessage && (
        <div className="fixed bottom-16 left-6 z-[100]">
          <div
            className={`
              flex items-center gap-2.5 rounded-xl border px-5 py-3 text-sm
              shadow-lg backdrop-blur-md toast-slide-in
              bg-[#111]/90 border-white/10 text-zinc-200
              shadow-black/40
            `}
          >
            {success && <CheckCircle2 size={18} className="text-green-400 shrink-0" />}
            <span className="font-medium">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 rounded-lg p-1 text-zinc-500 hover:text-zinc-300 transition"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Error notification — bottom-left, stacked above toast */}
      {error && (
        <div className="fixed bottom-36 left-6 z-[100] max-w-sm">
          <div className="
            flex items-start gap-2.5 rounded-xl border px-5 py-3 text-sm
            shadow-lg backdrop-blur-md toast-slide-in
            bg-[#111]/90 border-red-500/20 text-zinc-200
            shadow-black/40
          ">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <div>
              <p className="font-semibold text-red-300">Import Error</p>
              <p className="mt-1 text-xs text-red-400/80">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-1 shrink-0 rounded-lg p-1 text-zinc-500 hover:text-zinc-300 transition"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}
