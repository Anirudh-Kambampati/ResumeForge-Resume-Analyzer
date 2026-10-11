// ============================================================
// ResumeForge for Businesses — PDF screening report
// Cover with pool charts, the ranked stack, then one analysis
// page per screened candidate. Drawn in the app's paper style:
// ink outlines, hard shadows, marker stickers, red pencil notes.
// Loaded on demand from the export menu.
// ============================================================

import React from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import type { Candidate, ScreeningQueue } from "@/types/screening";
import { candidateAiTake, candidateDisplayName, exportFileName, rankCandidates, saveBlob } from "@/lib/screening";
import {
  Bullets,
  C,
  Card,
  Chips,
  Donut,
  Labeled,
  Meter,
  ReportFooter,
  ScoreSticker,
  Sparkle,
  Sticker,
  s,
  pdfSafeData,
  toneOf,
  type Tone,
} from "@/components/report/ReportKit";

function Footer({ queue }: { queue: ScreeningQueue }) {
  return <ReportFooter label={`ResumeForge · ${queue.name}`} />;
}

// ------------------------------------------------------------
// Cover: headline numbers and pool charts
// ------------------------------------------------------------

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card style={{ flex: 1 }} padding={10}>
      <Text style={s.eyebrow}>{label}</Text>
      <Text style={[s.serif, { fontSize: 26, lineHeight: 1 }]}>{value}</Text>
      {note && <Text style={[s.small, { marginTop: 3 }]}>{note}</Text>}
    </Card>
  );
}

const TONE_FILL: Record<Tone, string> = { good: C.marker, mid: C.mid, low: C.pencil };

function RankedBars({ scored }: { scored: Candidate[] }) {
  const shown = scored.slice(0, 12);
  return (
    <Card>
      <Text style={s.eyebrow}>Match scores, ranked{scored.length > shown.length ? ` · top ${shown.length} of ${scored.length}` : ""}</Text>
      {shown.map((c, i) => {
        const score = c.result!.match_score;
        const tone = toneOf(score);
        return (
          <View key={c.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={[s.serif, { width: 16, fontSize: 11 }]}>{i + 1}</Text>
            <Text style={{ width: 118, fontSize: 8, paddingRight: 6, maxLines: 1, textOverflow: "ellipsis" }}>
              {candidateDisplayName(c)}
            </Text>
            <View style={{ flex: 1, height: 10, borderRadius: 3, backgroundColor: C.track }}>
              <View
                style={{
                  width: `${Math.max(2, score)}%`,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: TONE_FILL[tone],
                  borderWidth: tone === "good" ? 1 : 0,
                  borderColor: C.ink,
                }}
              />
            </View>
            <Text style={{ width: 24, textAlign: "right", fontSize: 8.5, fontWeight: 700, color: tone === "low" ? C.pencil : C.ink }}>{score}</Text>
          </View>
        );
      })}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
        {(
          [
            ["good", "75+ strong"],
            ["mid", "50–74 possible"],
            ["low", "under 50"],
          ] as [Tone, string][]
        ).map(([tone, label]) => (
          <View key={tone} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: TONE_FILL[tone], borderWidth: tone === "good" ? 0.8 : 0, borderColor: C.ink, marginRight: 4 }} />
            <Text style={s.small}>{label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Distribution({ scored }: { scored: Candidate[] }) {
  const buckets: { tone: Tone; label: string; count: number }[] = [
    { tone: "good", label: "75+", count: 0 },
    { tone: "mid", label: "50–74", count: 0 },
    { tone: "low", label: "<50", count: 0 },
  ];
  for (const c of scored) buckets[["good", "mid", "low"].indexOf(toneOf(c.result!.match_score))].count++;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const height = 78;
  return (
    <Card style={{ flex: 1 }}>
      <Text style={s.eyebrow}>Score spread</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: height + 14, borderBottomWidth: 1.5, borderColor: C.ink }}>
        {buckets.map((b) => (
          <View key={b.label} style={{ alignItems: "center", width: 40 }}>
            <Text style={[s.serif, { fontSize: 13, lineHeight: 1, marginBottom: 2 }]}>{b.count}</Text>
            <View
              style={{
                width: 30,
                height: Math.max(2, (b.count / max) * height),
                backgroundColor: TONE_FILL[b.tone],
                borderWidth: b.tone === "good" ? 1 : 0,
                borderColor: C.ink,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 4 }}>
        {buckets.map((b) => (
          <Text key={b.label} style={[s.small, { width: 40, textAlign: "center" }]}>
            {b.label}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function RequiredCoverage({ queue, scored }: { queue: ScreeningQueue; scored: Candidate[] }) {
  const required = queue.requirements?.required_skills ?? [];
  if (required.length === 0 || scored.length === 0) return null;
  const rows = required
    .map((skill) => {
      const key = skill.toLowerCase();
      const have = scored.filter((c) => c.result!.required_skills.matched.some((m) => m.toLowerCase() === key)).length;
      return { skill, have };
    })
    .sort((a, b) => b.have - a.have)
    .slice(0, 10);
  return (
    <Card style={{ flex: 1.6 }}>
      <Text style={s.eyebrow}>Required skills across the pool</Text>
      {rows.map((r) => (
        <Meter
          key={r.skill}
          label={r.skill}
          value={r.have}
          max={scored.length}
          valueLabel={`${Math.round((r.have / scored.length) * 100)}%`}
          fill={r.have / scored.length < 0.25 ? C.pencil : C.ink}
        />
      ))}
    </Card>
  );
}

function CoverPage({ queue, ranked }: { queue: ScreeningQueue; ranked: Candidate[] }) {
  const scored = ranked.filter((c) => c.result);
  const avg = scored.length ? Math.round(scored.reduce((sum, c) => sum + c.result!.match_score, 0) / scored.length) : 0;
  const strong = scored.filter((c) => c.result!.match_score >= 75).length;
  const briefs = scored.filter((c) => candidateAiTake(c).source === "brief").length;
  const summaries = scored.filter((c) => candidateAiTake(c).source === "summary").length;
  const top = scored[0];
  const req = queue.requirements;
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <Page size="A4" style={s.page}>
      <Sticker>Screening report</Sticker>
      <Text style={[s.serif, { fontSize: 34, lineHeight: 1.05, marginTop: 10 }]}>{queue.name}</Text>
      <Text style={{ fontSize: 9.5, color: C.muted, marginTop: 8 }}>
        {req?.target_title ? `Hiring for ${req.target_title} · ` : ""}
        {date}
      </Text>
      {top && (
        <Text style={[s.hand, { fontSize: 17, marginTop: 6, marginBottom: 4, transform: "rotate(-1.5deg)" }]}>
          top pick so far: {candidateDisplayName(top)} ({top.result!.match_score})
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <StatTile label="Screened" value={String(scored.length)} note={ranked.length > scored.length ? `of ${ranked.length} uploaded` : "resumes"} />
        <StatTile label="Average match" value={String(avg)} note="out of 100" />
        <StatTile label="Strong matches" value={String(strong)} note="scored 75 or more" />
        <StatTile label="AI write-ups" value={String(briefs + summaries)} note={`${briefs} brief${briefs === 1 ? "" : "s"} · ${summaries} summar${summaries === 1 ? "y" : "ies"}`} />
      </View>

      {scored.length > 0 && <RankedBars scored={scored} />}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {scored.length > 0 && <Distribution scored={scored} />}
        <RequiredCoverage queue={queue} scored={scored} />
      </View>

      {req && (
        <Card>
          <Labeled label="Required skills">
            <Chips items={req.required_skills} tone="plain" empty="None listed." />
          </Labeled>
          <Labeled label="Preferred skills" last>
            <Chips items={req.preferred_skills} tone="plain" empty="None listed." />
          </Labeled>
        </Card>
      )}
      <Footer queue={queue} />
    </Page>
  );
}

// ------------------------------------------------------------
// The ranked stack
// ------------------------------------------------------------

const COL = { rank: 22, name: 130, match: 40, req: 38, ats: 30 };

function StackPage({ queue, ranked }: { queue: ScreeningQueue; ranked: Candidate[] }) {
  let rank = 0;
  return (
    <Page size="A4" style={s.page}>
      <Text style={[s.serif, { fontSize: 28, lineHeight: 1, marginBottom: 12 }]}>
        The stack, <Text style={[s.serif, { fontStyle: "italic" }]}>sorted</Text>
      </Text>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: C.ink,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          paddingVertical: 6,
          paddingHorizontal: 8,
        }}
      >
        {[
          ["#", COL.rank],
          ["Candidate", COL.name],
          ["Match", COL.match],
          ["Req.", COL.req],
          ["ATS", COL.ats],
        ].map(([label, width]) => (
          <Text key={label} style={{ width: Number(width), fontSize: 7, fontWeight: 700, letterSpacing: 0.8, color: C.paper, textTransform: "uppercase" }}>
            {label}
          </Text>
        ))}
        <Text style={{ flex: 1, fontSize: 7, fontWeight: 700, letterSpacing: 0.8, color: C.paper, textTransform: "uppercase" }}>AI take</Text>
      </View>
      <View style={{ borderWidth: 1.5, borderTopWidth: 0, borderColor: C.ink, backgroundColor: C.sheet }}>
        {ranked.map((c, i) => {
          const r = c.result;
          const take = candidateAiTake(c);
          const requiredTotal = r ? r.required_skills.matched.length + r.required_skills.missing.length : 0;
          return (
            <View
              key={c.id}
              wrap={false}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 7,
                paddingHorizontal: 8,
                borderTopWidth: i === 0 ? 0 : 0.75,
                borderColor: C.rule,
              }}
            >
              <Text style={[s.serif, { width: COL.rank, fontSize: 18, lineHeight: 1 }]}>{r ? ++rank : "–"}</Text>
              <View style={{ width: COL.name, paddingRight: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 600 }}>{candidateDisplayName(c)}</Text>
                <Text style={[s.small, { maxLines: 1, textOverflow: "ellipsis" }]}>
                  {c.status === "error" ? `Failed: ${c.error ?? "could not screen"}` : r?.candidate.email ?? c.fileName}
                </Text>
              </View>
              <View style={{ width: COL.match }}>
                {r ? <ScoreSticker score={r.match_score} size={26} /> : <Text style={s.small}>{c.status === "error" ? "Failed" : "Pending"}</Text>}
              </View>
              <Text style={{ width: COL.req, fontSize: 8.5 }}>{r ? (requiredTotal ? `${r.required_skills.matched.length}/${requiredTotal}` : "–") : ""}</Text>
              <Text style={{ width: COL.ats, fontSize: 8.5, color: C.muted }}>{r?.ats_score ?? ""}</Text>
              <View style={{ flex: 1, flexDirection: "row" }}>
                {take.text ? (
                  <>
                    <View style={{ marginTop: 2, marginRight: 4 }}>
                      <Sparkle />
                    </View>
                    <Text style={{ flex: 1, fontSize: 7.8, lineHeight: 1.4, color: C.muted }}>{take.text}</Text>
                  </>
                ) : (
                  <Text style={s.small}>{r ? "No AI summary generated" : ""}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <Footer queue={queue} />
    </Page>
  );
}

// ------------------------------------------------------------
// One analysis page per candidate
// ------------------------------------------------------------

const TITLE_NOTE: Record<string, string> = {
  exact: "exact title match!",
  normalized_close: "title is a close match",
  related: "related title",
  none: "title doesn't match the role",
};

function AiSection({ candidate }: { candidate: Candidate }) {
  const take = candidateAiTake(candidate);
  const brief = take.source === "brief" ? candidate.brief : undefined;
  return (
    <Card flat>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Sparkle size={10} />
        <Text style={{ fontSize: 10, fontWeight: 700, marginLeft: 5 }}>{brief ? "AI candidate brief" : "AI summary"}</Text>
      </View>

      {brief ? (
        <>
          <Text style={[s.body, { marginBottom: 9 }]}>{brief.summary}</Text>
          {brief.strengths.length > 0 && (
            <Labeled label="Strengths">
              <Bullets items={brief.strengths} color={C.green} />
            </Labeled>
          )}
          {brief.gaps.length > 0 && (
            <Labeled label="Gaps">
              <Bullets items={brief.gaps} color={C.amber} />
            </Labeled>
          )}
          {brief.interview_questions.length > 0 && (
            <Labeled label="Interview questions">
              <Bullets items={brief.interview_questions} color={C.pencil} />
            </Labeled>
          )}
        </>
      ) : take.text ? (
        <>
          <Text style={s.body}>{take.text}</Text>
          <Text style={[s.small, { marginTop: 6 }]}>No full brief was generated for this candidate, so this is the one-line AI summary from the ranking.</Text>
        </>
      ) : (
        <Text style={[s.body, { color: C.muted }]}>No AI summary or brief was generated for this candidate.</Text>
      )}

      {take.text && (
        <Text style={[s.small, { marginTop: 8, paddingTop: 6, borderTopWidth: 0.75, borderColor: C.rule }]}>
          AI-generated from the resume text. Verify before relying on it; it is not a hiring decision.
        </Text>
      )}
    </Card>
  );
}

function CandidatePage({ queue, candidate, rank, total }: { queue: ScreeningQueue; candidate: Candidate; rank: number; total: number }) {
  const r = candidate.result!;
  const preferredTotal = r.preferred_skills.matched.length + r.preferred_skills.missing.length;
  const respTotal = r.responsibilities.matched.length + r.responsibilities.missing.length;
  const keywordTotal = r.matched_keywords.length + r.missing_keywords.length;

  return (
    <Page size="A4" style={s.page}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
        <View style={{ width: 52 }}>
          <Text style={[s.serif, { fontSize: 40, lineHeight: 1 }]}>{rank}</Text>
          <Text style={s.small}>of {total}</Text>
        </View>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[s.serif, { fontSize: 26, lineHeight: 1.05 }]}>{candidateDisplayName(candidate)}</Text>
          <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>
            {[r.candidate.email, candidate.fileName].filter(Boolean).join(" · ")}
          </Text>
          <Text style={[s.hand, { fontSize: 15, marginTop: 5, transform: "rotate(-1.5deg)" }]}>{TITLE_NOTE[r.title_match] ?? ""}</Text>
        </View>
        <View style={{ alignItems: "center", marginRight: 14 }}>
          <ScoreSticker score={r.match_score} size={56} />
          <Text style={[s.eyebrow, { marginTop: 4, marginBottom: 0 }]}>Match</Text>
        </View>
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <ScoreSticker score={r.ats_score} size={40} />
          <Text style={[s.eyebrow, { marginTop: 4, marginBottom: 0 }]}>ATS</Text>
        </View>
      </View>

      <AiSection candidate={candidate} />

      {/* Charts */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1.1 }}>
          <Text style={s.eyebrow}>Score breakdown</Text>
          {r.categories.map((cat) => (
            <Meter key={cat.key} label={cat.label} value={cat.score} max={cat.max_score} />
          ))}
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={s.eyebrow}>Coverage</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 4 }}>
            <Donut label="Required" m={r.required_skills} />
            <Donut label="Preferred" m={r.preferred_skills} />
            <Donut label="Duties" m={r.responsibilities} />
          </View>
        </Card>
      </View>

      {/* Skills */}
      <Card>
        <Labeled label="Required skills found">
          <Chips items={r.required_skills.matched} tone="found" empty="None of the required skills were found." />
        </Labeled>
        <Labeled label="Required skills missing" last={preferredTotal === 0 && keywordTotal === 0}>
          <Chips items={r.required_skills.missing} tone="missing" empty="All required skills are present." />
        </Labeled>
        {preferredTotal > 0 && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Labeled label="Preferred found" last>
                <Chips items={r.preferred_skills.matched} tone="found" empty="None found." />
              </Labeled>
            </View>
            <View style={{ flex: 1 }}>
              <Labeled label="Preferred missing" last>
                <Chips items={r.preferred_skills.missing} tone="missing" empty="None missing." />
              </Labeled>
            </View>
          </View>
        )}
        {keywordTotal > 0 && (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 9, paddingTop: 8, borderTopWidth: 0.75, borderColor: C.rule }}>
            <View style={{ flex: 1 }}>
              <Labeled label={`Keywords matched (${r.matched_keywords.length})`} last>
                <Chips items={r.matched_keywords} tone="found" empty="None." limit={30} />
              </Labeled>
            </View>
            <View style={{ flex: 1 }}>
              <Labeled label={`Keywords missing (${r.missing_keywords.length})`} last>
                <Chips items={r.missing_keywords} tone="missing" empty="None." limit={30} />
              </Labeled>
            </View>
          </View>
        )}
      </Card>

      {respTotal > 0 && (
        <Card flat>
          {r.responsibilities.matched.length > 0 && (
            <Labeled label="Responsibilities with evidence" last={r.responsibilities.missing.length === 0}>
              <Bullets items={r.responsibilities.matched} color={C.ink} />
            </Labeled>
          )}
          {r.responsibilities.missing.length > 0 && (
            <Labeled label="Responsibilities without evidence" last>
              <Bullets items={r.responsibilities.missing} color={C.pencil} />
            </Labeled>
          )}
        </Card>
      )}

      <Footer queue={queue} />
    </Page>
  );
}

// ------------------------------------------------------------

export function ScreeningReport({ queue }: { queue: ScreeningQueue }) {
  const ranked = rankCandidates(queue.candidates);
  const scored = ranked.filter((c) => c.result);
  return (
    <Document title={`${queue.name} — screening report`} author="ResumeForge" creator="ResumeForge">
      <CoverPage queue={queue} ranked={ranked} />
      <StackPage queue={queue} ranked={ranked} />
      {scored.map((c, i) => (
        <CandidatePage key={c.id} queue={queue} candidate={c} rank={i + 1} total={scored.length} />
      ))}
    </Document>
  );
}

export async function downloadPdfReport(queue: ScreeningQueue): Promise<void> {
  // AI briefs can contain characters the report fonts lack (e.g. non-breaking hyphens)
  const blob = await pdf(<ScreeningReport queue={pdfSafeData(queue)} />).toBlob();
  saveBlob(blob, exportFileName(queue, "pdf"));
}
