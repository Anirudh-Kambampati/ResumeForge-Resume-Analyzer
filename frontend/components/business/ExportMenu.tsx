"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Sheet } from "lucide-react";
import type { ScreeningQueue } from "@/types/screening";
import { downloadCsv } from "@/lib/screening";

type Format = "csv" | "xlsx" | "pdf";

const OPTIONS: { format: Format; label: string; hint: string; icon: React.ReactNode }[] = [
  { format: "pdf", label: "PDF report", hint: "Charts and an analysis page per candidate", icon: <FileText size={15} /> },
  { format: "xlsx", label: "Excel workbook", hint: "Ranking, score breakdown, AI briefs, requirements", icon: <FileSpreadsheet size={15} /> },
  { format: "csv", label: "CSV", hint: "One row per candidate", icon: <Sheet size={15} /> },
];

/** Export the queue as a PDF report, an Excel workbook or a CSV. The PDF and Excel builders load on demand. */
export default function ExportMenu({ queue, disabled, className }: { queue: ScreeningQueue; disabled: boolean; className: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (format: Format) => {
    setOpen(false);
    setError(null);
    setBusy(format);
    try {
      if (format === "csv") downloadCsv(queue);
      else if (format === "xlsx") await (await import("@/lib/screeningExcel")).downloadExcel(queue);
      else await (await import("./ScreeningReportPDF")).downloadPdfReport(queue);
    } catch (e) {
      console.error(e);
      setError(`Could not build the ${format === "pdf" ? "PDF" : format === "xlsx" ? "Excel file" : "CSV"}. Try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => setOpen((v) => !v)}
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {busy ? "Exporting…" : "Export"}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="rf-card absolute right-0 z-30 mt-2 w-72 overflow-hidden p-1.5">
          {OPTIONS.map((o) => (
            <button
              key={o.format}
              type="button"
              role="menuitem"
              onClick={() => run(o.format)}
              className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
            >
              <span className="mt-0.5 text-zinc-400">{o.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-white">{o.label}</span>
                <span className="block text-xs text-zinc-500">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="absolute right-0 mt-1 whitespace-nowrap text-xs text-red-400">{error}</p>}
    </div>
  );
}
