// ============================================================
// Resume analysis — PDF report for one person's resume
// Scores as stickers, the ATS-check and job-match breakdowns,
// keywords, then strengths, gaps, suggestions, rewrites and
// interview focus. Same paper style as the business screening
// report (components/report/ReportKit). Loaded on demand.
// ============================================================

import React from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import {
  Bullets,
  C,
  Card,
  Chips,
  Labeled,
  Meter,
  ReportFooter,
  ScoreSticker,
  Sparkle,
  Sticker,
  pdfSafeData,
  s,
} from "@/components/report/ReportKit";
import { JOB_MATCH_LABELS, RULE_LABELS, breakdownLabel } from "@/lib/analysis";
import { saveBlob } from "@/lib/screening";

interface Breakdown {
  score: number;
  max_score: number;
}

/** The parts of an /api/analyze result the report draws. */
export interface AnalysisReportData {
  analysis_mode: "general" | "job_match";
  ai_review_available?: boolean;
  ai_review_error?: string | null;
  scores: {
    deterministic_rule_score: number;
    ai_review_score: number | null;
    job_match_score: number | null;
  };
  score_gap_insight: string;
  rule_breakdown: Record<string, Breakdown>;
  job_match_breakdown?: Record<string, Breakdown> | null;
  matched_keywords: string[];
  missing_keywords: string[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: { title: string; description: string; priority: "high" | "medium" | "low" }[];
  improved_bullets: { original: string; improved: string }[];
  interview_focus?: string[];
}

export interface AnalysisReportOptions {
  /** Uploaded file name, used for the title and the download name */
  fileName: string;
  /** Rewrites applied in the builder preview, by index into improved_bullets */
  appliedRewrites?: Set<number>;
}

/** "Jane_Doe_Resume (1).pdf" → "Jane Doe Resume" */
const stem = (fileName: string) =>
  fileName
    .replace(/\.(pdf|docx)$/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Resume";

/** A one-line, honest verdict on the ATS score, in red pencil. */
function verdict(ats: number): string {
  if (ats >= 85) return "reads cleanly for an ATS";
  if (ats >= 70) return "a few fixes away from great";
  if (ats >= 50) return "worth a careful pass before you send it";
  return "needs work before you send it";
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function ScoreBlock({ label, score, note }: { label: string; score: number | null; note: string }) {
  return (
    <View style={{ alignItems: "center", width: 120 }}>
      {score == null ? (
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: C.mid,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={[s.serif, { fontSize: 22, color: C.faint, lineHeight: 1 }]}>–</Text>
        </View>
      ) : (
        <ScoreSticker score={score} size={58} />
      )}
      <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 6 }}>{label}</Text>
      <Text style={[s.small, { textAlign: "center" }]}>{note}</Text>
    </View>
  );
}

function BreakdownCard({ title, items, labels }: { title: string; items: Record<string, Breakdown>; labels: Record<string, string> }) {
  const entries = Object.entries(items);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, b]) => sum + b.score, 0);
  const max = entries.reduce((sum, [, b]) => sum + b.max_score, 0);
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={[s.eyebrow, { marginBottom: 0 }]}>{title}</Text>
        <Text style={{ fontSize: 8, fontWeight: 700 }}>
          {total}
          <Text style={{ color: C.faint, fontWeight: 400 }}>/{max}</Text>
        </Text>
      </View>
      {entries.map(([key, b]) => {
        const low = b.max_score > 0 && b.score / b.max_score < 0.5;
        return <Meter key={key} label={breakdownLabel(key, labels)} value={b.score} max={b.max_score} fill={low ? C.pencil : C.ink} />;
      })}
    </Card>
  );
}

function PriorityTag({ priority }: { priority: "high" | "medium" | "low" }) {
  const style =
    priority === "high"
      ? { borderColor: C.pencil, color: C.pencil, borderStyle: "dashed" as const }
      : priority === "medium"
        ? { backgroundColor: C.marker, borderColor: C.ink, color: C.ink }
        : { borderColor: C.mid, color: C.muted };
  return (
    <Text
      style={[
        { fontSize: 6.5, lineHeight: 1, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", borderWidth: 1.2, borderRadius: 99, paddingTop: 3, paddingBottom: 2.5, paddingHorizontal: 6 },
        style,
      ]}
    >
      {priority}
    </Text>
  );
}

function SummaryPage({ data, options }: { data: AnalysisReportData; options: AnalysisReportOptions }) {
  const jobMatch = data.analysis_mode === "job_match";
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const aiAvailable = data.ai_review_available !== false;

  return (
    <Page size="A4" style={s.page}>
      <Sticker>Resume analysis</Sticker>
      <Text style={[s.serif, { fontSize: 32, lineHeight: 1.05, marginTop: 10 }]}>{stem(options.fileName)}</Text>
      <Text style={{ fontSize: 9.5, color: C.muted, marginTop: 6 }}>
        {jobMatch ? "Checked against a job description" : "General review"} · {date}
      </Text>
      <Text style={[s.hand, { fontSize: 17, marginTop: 6, marginBottom: 6, transform: "rotate(-1.5deg)" }]}>
        {verdict(data.scores.deterministic_rule_score)}
      </Text>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 }}>
          <ScoreBlock label="ATS score" score={data.scores.deterministic_rule_score} note="structure and parseability" />
          <ScoreBlock
            label="AI review"
            score={data.scores.ai_review_score}
            note={data.scores.ai_review_score == null ? "not available this time" : "clarity, impact, positioning"}
          />
          {jobMatch && (
            <ScoreBlock
              label="Job match"
              score={data.scores.job_match_score}
              note={data.scores.job_match_score == null ? "needs the AI review" : "fit for this role"}
            />
          )}
        </View>
      </Card>

      <Card flat>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <Sparkle size={10} />
          <Text style={{ fontSize: 10, fontWeight: 700, marginLeft: 5 }}>Summary</Text>
        </View>
        <Text style={s.body}>{data.summary}</Text>
        {aiAvailable && data.score_gap_insight ? (
          <View style={{ marginTop: 8, paddingTop: 7, borderTopWidth: 0.75, borderColor: C.rule }}>
            <Text style={s.eyebrow}>Why the scores differ</Text>
            <Text style={s.body}>{data.score_gap_insight}</Text>
          </View>
        ) : null}
        {!aiAvailable && (
          <Text style={[s.small, { marginTop: 7 }]}>
            {data.ai_review_error || "The AI review couldn't run."} The ATS score is rule-based and still accurate.
          </Text>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <BreakdownCard title="ATS checks" items={data.rule_breakdown} labels={RULE_LABELS} />
        {data.job_match_breakdown && <BreakdownCard title="Job match" items={data.job_match_breakdown} labels={JOB_MATCH_LABELS} />}
      </View>

      <ReportFooter label={`ResumeForge · ${stem(options.fileName)}`} />
    </Page>
  );
}

function DetailPage({ data, options }: { data: AnalysisReportData; options: AnalysisReportOptions }) {
  const suggestions = [...data.suggestions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const focus = data.interview_focus ?? [];
  const hasKeywords = data.matched_keywords.length + data.missing_keywords.length > 0;
  const nothing =
    data.strengths.length + data.weaknesses.length + suggestions.length + data.improved_bullets.length + focus.length === 0 &&
    !hasKeywords;
  if (nothing) return null;

  return (
    <Page size="A4" style={s.page}>
      <Text style={[s.serif, { fontSize: 28, lineHeight: 1, marginBottom: 12 }]}>
        What to <Text style={[s.serif, { fontStyle: "italic" }]}>fix next</Text>
      </Text>

      {(data.strengths.length > 0 || data.weaknesses.length > 0) && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {data.strengths.length > 0 && (
            <Card style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Strengths</Text>
              <Bullets items={data.strengths} color={C.green} />
            </Card>
          )}
          {data.weaknesses.length > 0 && (
            <Card style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Gaps</Text>
              <Bullets items={data.weaknesses} color={C.amber} />
            </Card>
          )}
        </View>
      )}

      {hasKeywords && (
        <Card>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Labeled label={`Keywords on your resume (${data.matched_keywords.length})`} last>
                <Chips items={data.matched_keywords} tone="found" empty="None found." limit={40} />
              </Labeled>
            </View>
            <View style={{ flex: 1 }}>
              <Labeled label={`Missing from your resume (${data.missing_keywords.length})`} last>
                <Chips items={data.missing_keywords} tone="missing" empty="Nothing missing." limit={40} />
              </Labeled>
            </View>
          </View>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card flat>
          <Text style={s.eyebrow}>Suggestions, most important first</Text>
          {suggestions.map((sg, i) => (
            <View
              key={i}
              wrap={false}
              style={{ paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 0.75, borderColor: C.rule }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={{ fontSize: 9.5, fontWeight: 700, flex: 1, paddingRight: 8 }}>{sg.title}</Text>
                <PriorityTag priority={sg.priority} />
              </View>
              <Text style={[s.body, { color: C.muted }]}>{sg.description}</Text>
            </View>
          ))}
        </Card>
      )}

      {data.improved_bullets.length > 0 && (
        <Card flat>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Sparkle size={10} />
            <Text style={{ fontSize: 10, fontWeight: 700, marginLeft: 5 }}>Suggested rewrites</Text>
          </View>
          {data.improved_bullets.map((b, i) => {
            const applied = options.appliedRewrites?.has(i);
            return (
              <View
                key={i}
                wrap={false}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: applied ? 7 : 0,
                  borderTopWidth: i === 0 ? 0 : 0.75,
                  borderColor: C.rule,
                  backgroundColor: applied ? "#fff3c4" : undefined,
                  borderRadius: applied ? 6 : 0,
                }}
              >
                <Text style={{ fontSize: 8, color: C.faint, textDecoration: "line-through", textDecorationColor: C.pencil }}>
                  {b.original}
                </Text>
                <Text style={[s.body, { marginTop: 3 }]}>{b.improved}</Text>
                {applied && <Text style={[s.hand, { fontSize: 12, marginTop: 2 }]}>applied in the builder preview</Text>}
              </View>
            );
          })}
          <Text style={[s.small, { marginTop: 6, paddingTop: 6, borderTopWidth: 0.75, borderColor: C.rule }]}>
            AI-suggested wording built only from what your resume already says. Check each one before you use it.
          </Text>
        </Card>
      )}

      {focus.length > 0 && (
        <Card>
          <Text style={s.eyebrow}>Be ready to talk about</Text>
          <Bullets items={focus} color={C.pencil} />
        </Card>
      )}

      <ReportFooter label={`ResumeForge · ${stem(options.fileName)}`} />
    </Page>
  );
}

export function AnalysisReport({ data, options }: { data: AnalysisReportData; options: AnalysisReportOptions }) {
  return (
    <Document title={`${stem(options.fileName)} — resume analysis`} author="ResumeForge" creator="ResumeForge">
      <SummaryPage data={data} options={options} />
      <DetailPage data={data} options={options} />
    </Document>
  );
}

export async function downloadAnalysisReport(data: AnalysisReportData, options: AnalysisReportOptions): Promise<void> {
  const blob = await pdf(<AnalysisReport data={pdfSafeData(data)} options={options} />).toBlob();
  const name = stem(options.fileName).replace(/[^\w\- ]+/g, "").trim() || "resume";
  saveBlob(blob, `${name} - analysis.pdf`);
}
