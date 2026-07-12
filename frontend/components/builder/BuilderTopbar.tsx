"use client";

import { Download, RotateCcw, CloudCheck, CloudLightning, Loader2 } from "lucide-react";
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ResumePDFDocument } from "./preview/ResumePDFDocument";
import { useResumeStore } from "@/store/resumeStore";

type Props = {
  resetResume: () => void;
  saveStatus: "Saved" | "Saving...";
  fullName?: string;
};

export default function BuilderTopbar({
  resetResume,
  saveStatus,
  fullName,
}: Props) {
  const resume = useResumeStore((state) => state.resume);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const blob = await pdf(<ResumePDFDocument resume={resume} />).toBlob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      const safeName = (fullName || "Resume").replace(/[^a-z0-9]/gi, '_');
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF generation failed", error);
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

        {/* Autosave Status Badge */}
        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/5 px-3 py-1 text-xs">
          {saveStatus === "Saved" ? (
            <>
              <CloudCheck className="text-green-500" size={14} />
              <span className="text-zinc-400 font-medium">Saved</span>
            </>
          ) : (
            <>
              <CloudLightning className="text-yellow-500 animate-pulse" size={14} />
              <span className="text-zinc-400 font-medium">Saving...</span>
            </>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">

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
          {isDownloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          {isDownloading ? "Generating..." : "Download PDF"}
        </button>

      </div>

    </header>
  );
}