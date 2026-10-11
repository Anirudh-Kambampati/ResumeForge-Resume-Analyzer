// ============================================================
// ResumeForge for Businesses — Excel export
// One workbook per queue: ranking, score breakdown, AI briefs
// and the job requirements. Loaded on demand (exceljs is large).
// ============================================================

import type { Borders, Cell, Fill, Font, Workbook, Worksheet } from "exceljs";
import type { ScreeningQueue } from "@/types/screening";
import { candidateAiTake, candidateDisplayName, exportFileName, rankCandidates, saveBlob } from "@/lib/screening";

// Paper palette from globals.css (ARGB)
const INK = "FF1F1B16";
const PAPER = "FFF6F1E7";
const SHEET = "FFFFFDF8";
const MARKER = "FFFFD84D";
const PENCIL = "FFBF3119";
const MUTED = "FF5E554B";
const RULE = "FFE2D7C3";

const FONT = "Calibri";

const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin: Borders = {
  top: { style: "thin", color: { argb: RULE } },
  bottom: { style: "thin", color: { argb: RULE } },
  left: { style: "thin", color: { argb: RULE } },
  right: { style: "thin", color: { argb: RULE } },
  diagonal: {},
};

const TITLE_MATCH: Record<string, string> = {
  exact: "Exact",
  normalized_close: "Close",
  related: "Related",
  none: "None",
};

function styleHeader(sheet: Worksheet): void {
  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = solid(INK);
    cell.font = { name: FONT, bold: true, color: { argb: PAPER } } as Partial<Font>;
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = thin;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function styleBody(sheet: Worksheet): void {
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, color: { argb: INK } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thin;
      if (n % 2 === 0) cell.fill = solid(SHEET);
    });
  });
}

/** Marker for 75+, plain for 50–74, red pencil below — the score sticker tones. */
function toneScore(cell: Cell, score: number | undefined): void {
  if (score == null) return;
  cell.alignment = { horizontal: "center", vertical: "top" };
  if (score >= 75) {
    cell.fill = solid(MARKER);
    cell.font = { name: FONT, bold: true, color: { argb: INK } };
  } else if (score < 50) {
    cell.font = { name: FONT, bold: true, color: { argb: PENCIL } };
  } else {
    cell.font = { name: FONT, bold: true, color: { argb: INK } };
  }
}

function addDataBar(sheet: Worksheet, column: string, rows: number, max = 100): void {
  if (rows < 1) return;
  sheet.addConditionalFormatting({
    ref: `${column}2:${column}${rows + 1}`,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        minLength: 0,
        maxLength: 100,
        gradient: false,
        border: false,
        cfvo: [
          { type: "num", value: 0 },
          { type: "num", value: max },
        ],
        color: { argb: "FFFFC83D" },
      } as never,
    ],
  });
}

function rankingSheet(wb: Workbook, queue: ScreeningQueue): void {
  const sheet = wb.addWorksheet("Ranking", { properties: { tabColor: { argb: MARKER } } });
  sheet.columns = [
    { header: "Rank", key: "rank", width: 7 },
    { header: "Candidate", key: "name", width: 26 },
    { header: "Email", key: "email", width: 28 },
    { header: "Match score", key: "match", width: 12 },
    { header: "ATS score", key: "ats", width: 10 },
    { header: "Required skills", key: "required", width: 11 },
    { header: "Required missing", key: "missing", width: 30 },
    { header: "Preferred matched", key: "preferred", width: 30 },
    { header: "Title match", key: "title", width: 11 },
    { header: "AI take", key: "take", width: 70 },
    { header: "AI source", key: "source", width: 11 },
    { header: "Status", key: "status", width: 14 },
    { header: "File", key: "file", width: 28 },
  ];

  let rank = 0;
  const ranked = rankCandidates(queue.candidates);
  for (const c of ranked) {
    const r = c.result;
    const take = candidateAiTake(c);
    const requiredTotal = r ? r.required_skills.matched.length + r.required_skills.missing.length : 0;
    sheet.addRow({
      rank: r ? ++rank : null,
      name: candidateDisplayName(c),
      email: r?.candidate.email ?? "",
      match: r?.match_score ?? null,
      ats: r?.ats_score ?? null,
      required: r && requiredTotal ? `${r.required_skills.matched.length}/${requiredTotal}` : "",
      missing: r?.required_skills.missing.join(", ") ?? "",
      preferred: r?.preferred_skills.matched.join(", ") ?? "",
      title: r ? TITLE_MATCH[r.title_match] ?? r.title_match : "",
      take: take.text,
      source: take.source === "brief" ? "AI brief" : take.source === "summary" ? "AI summary" : "",
      status: c.status === "error" ? `Error: ${c.error ?? ""}` : c.status,
      file: c.fileName,
    });
  }

  styleBody(sheet);
  // Score tones go on after the zebra fill so they win
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const c = ranked[n - 2];
    if (c?.result) {
      toneScore(row.getCell("match"), c.result.match_score);
      toneScore(row.getCell("ats"), c.result.ats_score);
    }
    row.getCell("rank").alignment = { horizontal: "center", vertical: "top" };
    row.getCell("required").alignment = { horizontal: "center", vertical: "top" };
    row.getCell("missing").font = { name: FONT, color: { argb: PENCIL } };
  });
  styleHeader(sheet);
  sheet.autoFilter = { from: "A1", to: "M1" };
}

function breakdownSheet(wb: Workbook, queue: ScreeningQueue): void {
  const scored = rankCandidates(queue.candidates).filter((c) => c.result);
  // Category order from the first result; any extra keys are appended
  const categories: { key: string; label: string; max: number }[] = [];
  for (const c of scored) {
    for (const cat of c.result!.categories) {
      if (!categories.some((x) => x.key === cat.key)) categories.push({ key: cat.key, label: cat.label, max: cat.max_score });
    }
  }

  const sheet = wb.addWorksheet("Score breakdown");
  sheet.columns = [
    { header: "Rank", key: "rank", width: 7 },
    { header: "Candidate", key: "name", width: 26 },
    { header: "Match score", key: "match", width: 12 },
    ...categories.map((cat) => ({ header: `${cat.label} (/${cat.max})`, key: `cat_${cat.key}`, width: 16 })),
    { header: "Required coverage %", key: "reqPct", width: 14 },
    { header: "Preferred coverage %", key: "prefPct", width: 14 },
    { header: "Responsibilities %", key: "respPct", width: 14 },
  ];

  const pct = (m: { matched: string[]; missing: string[] }) => {
    const total = m.matched.length + m.missing.length;
    return total ? Math.round((m.matched.length / total) * 100) : null;
  };

  scored.forEach((c, i) => {
    const r = c.result!;
    const values: Record<string, unknown> = {
      rank: i + 1,
      name: candidateDisplayName(c),
      match: r.match_score,
      reqPct: pct(r.required_skills),
      prefPct: pct(r.preferred_skills),
      respPct: pct(r.responsibilities),
    };
    for (const cat of r.categories) values[`cat_${cat.key}`] = cat.score;
    sheet.addRow(values);
  });

  styleBody(sheet);
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    toneScore(row.getCell("match"), scored[n - 2]?.result?.match_score);
    row.eachCell((cell, col) => {
      if (col !== 2) cell.alignment = { horizontal: "center", vertical: "top" };
    });
  });
  styleHeader(sheet);

  const colLetter = (key: string) => sheet.getColumn(key).letter;
  addDataBar(sheet, colLetter("match"), scored.length);
  for (const cat of categories) addDataBar(sheet, colLetter(`cat_${cat.key}`), scored.length, cat.max);
  for (const key of ["reqPct", "prefPct", "respPct"]) addDataBar(sheet, colLetter(key), scored.length);
}

function briefsSheet(wb: Workbook, queue: ScreeningQueue): void {
  const sheet = wb.addWorksheet("AI briefs");
  sheet.columns = [
    { header: "Rank", key: "rank", width: 7 },
    { header: "Candidate", key: "name", width: 26 },
    { header: "Source", key: "source", width: 11 },
    { header: "Summary", key: "summary", width: 60 },
    { header: "Strengths", key: "strengths", width: 50 },
    { header: "Gaps", key: "gaps", width: 50 },
    { header: "Interview questions", key: "questions", width: 60 },
  ];
  const bullets = (items: string[] | undefined) => (items ?? []).map((x) => `• ${x}`).join("\n");

  rankCandidates(queue.candidates)
    .filter((c) => c.result)
    .forEach((c, i) => {
      const take = candidateAiTake(c);
      const brief = take.source === "brief" ? c.brief : undefined;
      sheet.addRow({
        rank: i + 1,
        name: candidateDisplayName(c),
        source: take.source === "brief" ? "AI brief" : take.source === "summary" ? "AI summary" : "Not generated",
        summary: take.text,
        strengths: bullets(brief?.strengths),
        gaps: bullets(brief?.gaps),
        questions: bullets(brief?.interview_questions),
      });
    });

  styleBody(sheet);
  styleHeader(sheet);
}

function requirementsSheet(wb: Workbook, queue: ScreeningQueue): void {
  const sheet = wb.addWorksheet("Job requirements");
  sheet.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 100 },
  ];
  const req = queue.requirements;
  const rows: [string, string][] = [
    ["Queue", queue.name],
    ["Exported", new Date().toLocaleString()],
    ["Target title", req?.target_title ?? ""],
    ["Required skills", req?.required_skills.join(", ") ?? ""],
    ["Preferred skills", req?.preferred_skills.join(", ") ?? ""],
    ["Domain keywords", req?.domain_keywords.join(", ") ?? ""],
    ["Responsibilities", req?.responsibilities.map((x) => `• ${x}`).join("\n") ?? ""],
    ["Job description", queue.jobDescription.trim()],
  ];
  for (const [field, value] of rows) sheet.addRow({ field, value });
  styleBody(sheet);
  sheet.eachRow((row, n) => {
    if (n > 1) row.getCell("field").font = { name: FONT, bold: true, color: { argb: MUTED } };
  });
  styleHeader(sheet);
}

export async function buildExcel(queue: ScreeningQueue): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ResumeForge";
  wb.created = new Date();

  rankingSheet(wb, queue);
  breakdownSheet(wb, queue);
  briefsSheet(wb, queue);
  requirementsSheet(wb, queue);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadExcel(queue: ScreeningQueue): Promise<void> {
  saveBlob(
    new Blob([await buildExcel(queue)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    exportFileName(queue, "xlsx"),
  );
}
