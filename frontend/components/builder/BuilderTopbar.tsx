"use client";

import { Download, RotateCcw, CloudCheck, CloudLightning } from "lucide-react";

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
  const handleDownload = () => {
    window.open("/print", "_blank");
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
          "
        >
          <Download size={16} />
          Download PDF
        </button>

      </div>

    </header>
  );
}