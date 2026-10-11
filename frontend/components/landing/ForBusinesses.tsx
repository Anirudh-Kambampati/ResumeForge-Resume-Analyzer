import Link from "next/link";
import { ArrowRight } from "lucide-react";

const points = [
  {
    title: "Every opening, in parallel",
    description: "Run a queue per role and screen them all at once.",
  },
  {
    title: "Same scoring engine",
    description: "The job-match scoring candidates use, applied to every applicant the same way.",
  },
  {
    title: "Your AI, your key",
    description: "On-demand summaries and interview questions for your shortlist, on your own OpenAI, Anthropic, Gemini, Groq or OpenRouter key.",
  },
];

// Decorative: a few index cards from a sorted stack (made-up sample data)
const stack = [
  { rank: 1, name: "A. Rivera", score: 91, tilt: "-rotate-[1.5deg]", low: false },
  { rank: 2, name: "J. Chen", score: 84, tilt: "rotate-[0.8deg]", low: false },
  { rank: 3, name: "M. Novak", score: 58, tilt: "-rotate-[0.4deg]", low: true },
];

export default function ForBusinesses() {
  return (
    <section
      id="business"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24"
    >
      {/* The band inverts the theme: ink on paper, paper on Night desk */}
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-12 rounded-[28px] bg-zinc-50 p-8 text-zinc-950 sm:p-12">
        <div className="min-w-0 flex-[1_1_440px]">
          <span className="rf-sticker px-3.5 py-1 text-sm">For hiring teams</span>
          <h2 className="mt-5 font-serif text-5xl font-normal leading-[1.02] md:text-6xl">
            Bring the red pencil to the <em>whole stack.</em>
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-950/75">
            The analysis that helps candidates match a job description also helps hiring teams read a stack
            of applications. Paste a role, drop in the resumes, and get a ranked shortlist with the evidence
            behind every score.
          </p>

          <ul className="mt-7 space-y-3.5">
            {points.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rotate-45 border-[1.5px] border-zinc-950 bg-marker" aria-hidden="true" />
                <p className="text-zinc-950/75">
                  <span className="font-bold text-zinc-950">{point.title}.</span> {point.description}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <Link
              href="/business"
              className="rf-btn border-zinc-950 bg-marker text-[#1f1b16] shadow-[4px_4px_0_var(--color-zinc-950)] hover:shadow-[5px_5px_0_var(--color-zinc-950)]"
            >
              Explore for businesses <ArrowRight size={16} />
            </Link>
            <Link
              href="/business/screening"
              className="rf-btn border-zinc-950 bg-transparent text-zinc-950 shadow-none hover:bg-zinc-950/10 hover:shadow-none"
            >
              Open the workspace
            </Link>
          </div>
        </div>

        <ol aria-hidden="true" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 p-2">
          {stack.map((card) => (
            <li
              key={card.rank}
              className={`flex items-center gap-4 rounded-xl bg-panel px-5 py-4 text-white ${card.tilt}`}
            >
              <span className="w-6 font-serif text-3xl">{card.rank}</span>
              <span className="flex-1 font-bold">{card.name}</span>
              <span
                className={`rf-score h-12 w-12 text-2xl shadow-none ${card.low ? "rf-score--low -rotate-6" : "rf-score--good rotate-3"}`}
              >
                {card.score}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
