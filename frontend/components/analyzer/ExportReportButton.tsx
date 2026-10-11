"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { AnalysisReportData } from "./AnalysisReportPDF";

/** Download the analysis as a PDF report. The PDF builder loads on first click. */
export default function ExportReportButton({
  data,
  fileName,
  appliedRewrites,
  className = "",
}: {
  data: AnalysisReportData;
  fileName: string;
  appliedRewrites?: Set<number>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { downloadAnalysisReport } = await import("./AnalysisReportPDF");
      await downloadAnalysisReport(data, { fileName, appliedRewrites });
    } catch (e) {
      console.error(e);
      setError("Could not build the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={run} disabled={busy} className={`rf-btn gap-1.5 px-3 text-sm ${className}`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
        {busy ? "Building PDF…" : "Export PDF"}
      </button>
      {error && <p className="absolute right-0 mt-1 whitespace-nowrap text-xs text-red-400">{error}</p>}
    </div>
  );
}
