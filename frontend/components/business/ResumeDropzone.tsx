"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { RESUME_ACCEPT_ATTRIBUTE } from "@/lib/useResumeImport";
import { MAX_CANDIDATES_PER_QUEUE } from "@/lib/screening";
import { useScreeningStore } from "@/store/screeningStore";

/** Multi-file drop target. Files can be added to a queue at any time, even while it runs. */
export default function ResumeDropzone({ queueId, compact = false }: { queueId: string; compact?: boolean }) {
  const addFiles = useScreeningStore((s) => s.addFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { added, skipped } = addFiles(queueId, Array.from(list));
    if (skipped.length) {
      const shown = skipped.slice(0, 3).join(", ");
      const more = skipped.length > 3 ? ` and ${skipped.length - 3} more` : "";
      setNotice(`Added ${added}. Skipped ${shown}${more}.`);
    } else {
      setNotice(null);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-all duration-200 ${
          compact ? "p-4" : "p-8"
        } ${
          dragActive
            ? "border-blue-500 bg-blue-500/5"
            : "border-white/10 hover:border-blue-500/50 hover:bg-white/[0.01]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={RESUME_ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload size={compact ? 20 : 28} className="text-zinc-500" />
        <p className="text-sm font-medium text-zinc-300">
          Drop resumes here, or click to browse
        </p>
        {!compact && (
          <p className="text-xs text-zinc-600">
            PDF or DOCX · up to 5MB each · {MAX_CANDIDATES_PER_QUEUE} per queue
          </p>
        )}
      </div>
      {notice && <p className="mt-2 text-xs text-amber-400">{notice}</p>}
    </div>
  );
}
