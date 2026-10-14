"use client";

// Interactive illustration of the screening workspace: queues as folder tabs
// and a sorted stack of candidates. Pick a tab to switch openings, pick a
// candidate to read their AI brief. The data is made up.

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";

type Candidate = { name: string; score: number; required: string; missing: string[]; brief: string };
type Queue = { name: string; status: string; rows: Candidate[] };

const queues: Queue[] = [
  {
    name: "Backend Engineer",
    status: "42 / 60 screened",
    rows: [
      {
        name: "A. Rivera", score: 91, required: "9/9", missing: [],
        brief: "Every required skill shows up in a job or project, not just the skills list. Worth asking who owned the on-call rotation.",
      },
      {
        name: "J. Chen", score: 84, required: "8/9", missing: ["kafka"],
        brief: "Strong Go and Postgres work at two fintechs. No streaming experience listed; ask how they'd approach an event pipeline.",
      },
      {
        name: "S. Okafor", score: 77, required: "7/9", missing: ["kafka", "terraform"],
        brief: "Solid API design and testing habits. Infrastructure is hand-managed so far; probe comfort with infrastructure as code.",
      },
      {
        name: "M. Novak", score: 58, required: "5/9", missing: ["go", "kafka", "aws"],
        brief: "Mostly frontend with some Node services. Promising, but a stretch for this role; better fit for the full-stack opening.",
      },
    ],
  },
  {
    name: "Product Designer",
    status: "done",
    rows: [
      {
        name: "L. Moreau", score: 88, required: "6/6", missing: [],
        brief: "Shipped a design system used by four squads, with research behind each decision. Ask for the messiest project in the portfolio.",
      },
      {
        name: "D. Park", score: 80, required: "5/6", missing: ["usability testing"],
        brief: "Excellent visual craft and prototyping. Research is light; ask how they validate a flow before handoff.",
      },
      {
        name: "R. Haddad", score: 69, required: "4/6", missing: ["figma", "design systems"],
        brief: "Strong UX writing and research background. Tooling is mostly Sketch; check appetite for switching.",
      },
    ],
  },
  {
    name: "Data Analyst",
    status: "9 / 35",
    rows: [
      {
        name: "K. Osei", score: 86, required: "7/7", missing: [],
        brief: "SQL and dashboards in every role, plus an A/B testing project with clear outcomes. Ask about stakeholder pushback.",
      },
      {
        name: "T. Ivanova", score: 73, required: "6/7", missing: ["dbt"],
        brief: "Deep statistics background from academia. Less production tooling; ask how they'd keep metrics consistent across teams.",
      },
      {
        name: "P. Shah", score: 55, required: "4/7", missing: ["sql", "tableau", "python"],
        brief: "Spreadsheet-heavy operations role so far. Curious and quantitative, but would need ramp-up on the core stack.",
      },
    ],
  },
];

export default function ScreeningPreview({ className = "" }: { className?: string }) {
  const [queueIndex, setQueueIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const queue = queues[queueIndex];
  const candidate = queue.rows[selected];

  const pickQueue = (i: number) => {
    setQueueIndex(i);
    setSelected(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={`w-full ${className}`}>
        {/* Folder tabs */}
        <div role="tablist" aria-label="Sample openings" className="flex gap-1.5 overflow-hidden px-1">
          {queues.map((q, i) => {
            const active = i === queueIndex;
            return (
              <button
                key={q.name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pickQueue(i)}
                className={`min-w-0 shrink rounded-t-xl border-2 border-b-0 border-line px-3 pb-2 pt-2 text-left transition-[margin,background-color] duration-200 ${
                  active ? "relative top-0.5 mt-0 bg-panel" : "mt-1.5 bg-zinc-900 hover:mt-0.5"
                }`}
              >
                <div className="truncate text-xs font-extrabold sm:text-sm">{q.name}</div>
                <div className="truncate text-[10px] text-zinc-500 sm:text-[11px]">{q.status}</div>
              </button>
            );
          })}
        </div>

        {/* Folder body: the sorted stack */}
        <div role="tabpanel" aria-label={queue.name} className="rf-card rounded-tl-none p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-serif text-2xl sm:text-3xl">
              The stack, <em>sorted</em>
            </div>
            <span className="rf-hand text-lg">{queue.rows.length} ranked</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={queue.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-2"
            >
              {queue.rows.map((r, i) => {
                const low = r.score < 60;
                const isSelected = i === selected;
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 bg-panel px-3 py-2 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 ${
                        isSelected
                          ? "-translate-y-0.5 border-pencil shadow-[3px_3px_0_var(--pencil)]"
                          : "border-line shadow-[2px_2px_0_var(--shadow-color)]"
                      }`}
                    >
                      <span className="w-5 font-serif text-2xl leading-none">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{r.name}</span>
                      <span className="hidden text-xs font-bold sm:inline">{r.required}</span>
                      <span className="hidden min-w-0 truncate text-xs text-pencil line-through decoration-2 sm:inline">
                        {r.missing.join(" · ")}
                      </span>
                      <span
                        className={`rf-score h-10 w-10 shrink-0 text-xl shadow-none ${
                          low ? "rf-score--low rotate-6" : "rf-score--good -rotate-6"
                        }`}
                      >
                        {r.score}
                      </span>
                    </button>
                  </li>
                );
              })}
            </motion.ol>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${queue.name}-${candidate.name}`}
              initial={{ opacity: 0, rotate: -3, y: 6 }}
              animate={{ opacity: 1, rotate: -1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="rf-note mt-4 px-4 py-3"
              aria-live="polite"
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em]">AI brief · {candidate.name}</div>
              <p className="mt-1 text-xs leading-relaxed sm:text-sm">{candidate.brief}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
