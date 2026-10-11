import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  EyeOff,
  FileStack,
  Layers,
  ListOrdered,
  Lock,
  Scale,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import ScreeningPreview from "@/components/business/ScreeningPreview";

export const metadata: Metadata = {
  title: "ResumeForge for Businesses",
  description:
    "Screen resumes against a job description in bulk. Parallel queues, transparent deterministic scoring, and on-demand AI candidate briefs.",
};

// Each section fills the screen and is a snap point (the home page scrolls the same way)
const SNAP_SECTION = "flex min-h-screen snap-start flex-col justify-center px-6";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#queues", label: "Parallel queues" },
  { href: "#scoring", label: "Scoring" },
  { href: "#privacy", label: "Privacy" },
  { href: "/", label: "For job seekers" },
];

const steps = [
  {
    icon: ClipboardList,
    title: "Paste the job description",
    description:
      "AI reads the posting once, using your own API key, and pulls out the target title, required and preferred skills, domain terms and responsibilities.",
  },
  {
    icon: SlidersHorizontal,
    title: "Review the requirements",
    description:
      "Every requirement is an editable chip. Remove what doesn't matter, add what the posting forgot, then start the queue.",
  },
  {
    icon: FileStack,
    title: "Drop in the resumes",
    description:
      "Up to 200 PDF or DOCX files per queue. Each one is scored against the same requirements, with no AI in the loop.",
  },
  {
    icon: ListOrdered,
    title: "Work the shortlist",
    description:
      "Candidates rank as they finish. Open any row for the evidence, generate an AI brief for the ones worth a call, export to CSV.",
  },
];

const lanes = [
  { name: "Backend Engineer", cells: "dddddddddaaawwwwwwww" },
  { name: "Product Designer", cells: "dddddddddddddddddddd" },
  { name: "Data Analyst", cells: "dddaaawwwwwwwwwwwwww" },
  { name: "Support Lead", cells: "pppppppppppppppppppp" },
];

const scoring = [
  { label: "Required skills", points: 25, detail: "Share of the required skills found anywhere in the resume, including known aliases." },
  { label: "Title alignment", points: 15, detail: "Whether the target title, or a close variant, appears in the resume header." },
  { label: "Domain terminology", points: 15, detail: "Coverage of the role's domain vocabulary." },
  { label: "Hands-on evidence", points: 15, detail: "Required skills shown inside experience or project entries, not just a skills list." },
  { label: "Preferred skills", points: 10, detail: "Share of nice-to-have skills found." },
  { label: "Responsibilities", points: 10, detail: "Responsibilities whose key words appear in experience or projects." },
  { label: "Keyword coverage", points: 10, detail: "Overall coverage, minus a penalty for obvious keyword stuffing." },
];

const principles = [
  {
    icon: Lock,
    title: "Your data stays in your browser",
    description:
      "Resumes are processed in memory and discarded — nothing reaches our servers. Rankings and briefs are saved only in your browser's own storage, and a Clear-saved button erases them. Export a CSV to keep a record.",
  },
  {
    icon: Scale,
    title: "The AI never sets the score",
    description:
      "Ranking is deterministic: the same resume and requirements always score the same. AI only drafts the requirements you review and the briefs you ask for.",
  },
  {
    icon: EyeOff,
    title: "Briefs ignore who, not what",
    description:
      "The brief prompt tells the model to disregard names, age, gender, ethnicity and other protected characteristics, and to cite only what the resume says.",
  },
  {
    icon: Sparkles,
    title: "Evidence, not verdicts",
    description:
      "Scores show how well a resume documents the requirements. They help you decide who to read first. They are not a hiring decision, and you shouldn't treat them as one.",
  },
];

const faqs = [
  {
    q: "How is this different from the candidate-side analyzer?",
    a: "It uses the same job-match engine. The difference is scale and direction: one job description against many resumes, ranked, instead of one resume against one job.",
  },
  {
    q: "How many queues can I run at once?",
    a: "As many as you like. Up to six resumes are in flight at any moment, shared fairly between running queues, so a big queue never blocks a small one.",
  },
  {
    q: "What happens with scanned or image-only PDFs?",
    a: "Text can't be extracted from them, so they show as failed with the reason. Ask the candidate for a text-based PDF or DOCX.",
  },
  {
    q: "Can a candidate game the score with keywords?",
    a: "Repeating a term many times is penalised, and a quarter of the score needs skills to appear inside actual experience or project entries. Read the evidence before you act on a score.",
  },
  {
    q: "Does it cost anything?",
    a: "Screening and ranking are free. The AI steps (reading the job description and writing candidate briefs) run on your own API key from OpenAI, Anthropic, Google Gemini, Groq or OpenRouter, billed by that provider. The key stays in your browser and is never stored on our servers.",
  },
];

function SectionHeading({ badge, title, children }: { badge: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <div className="rf-sticker px-4 py-1.5 text-sm">
        {badge}
      </div>
      <h2 className="mt-6 font-serif text-5xl font-normal leading-[1.02] md:text-6xl">{title}</h2>
      {children && <p className="mt-5 text-lg leading-8 text-zinc-400">{children}</p>}
    </div>
  );
}

export default function BusinessPage() {
  return (
    <>
      <Navbar
        links={NAV_LINKS}
        logoHref="/"
        badge="for Businesses"
        cta={{ href: "/business/screening", label: "Open workspace" }}
      />

      {/* Full-screen snap sections, like the home page */}
      <main className="h-screen snap-y snap-mandatory overflow-y-auto scroll-smooth pt-20">
        {/* ---------- Hero ---------- */}
        <section className={`relative overflow-hidden pb-24 pt-16 md:pt-20 ${SNAP_SECTION}`}>
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <div className="rf-sticker px-4 py-1.5 text-sm">
                ResumeForge for Businesses
              </div>
              <h1 className="mt-7 font-serif text-6xl font-normal leading-[0.98] tracking-[-0.01em] md:text-7xl">
                Screen every applicant.
                <br />
                <span className="rf-mark italic">
                  Read the right ones first.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
                Paste a job description, drop in the resumes, and get a ranked shortlist with the evidence
                behind every score. Run a queue per opening; they all screen at the same time.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/business/screening"
                  className="rf-btn rf-btn-primary min-h-[56px] px-7 text-base"
                >
                  Start screening <ArrowRight size={16} />
                </Link>
                <a
                  href="#how"
                  className="rf-btn min-h-[56px] px-7 text-base"
                >
                  See how it works
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
                <span>No sign-up</span>
                <span>Bring your own AI key</span>
                <span>Nothing stored</span>
                <span>PDF &amp; DOCX</span>
                <span>CSV export</span>
              </div>
            </div>
            <ScreeningPreview />
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className={`py-24 ${SNAP_SECTION}`}>
          <div className="mx-auto max-w-7xl">
            <SectionHeading badge="How it works" title="From posting to shortlist in four steps">
              One AI call on your own key to understand the role. Free, deterministic scoring for every resume after that.
            </SectionHeading>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="rf-card p-6 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <step.icon size={20} className="text-blue-400" />
                    <span className="text-sm font-semibold tracking-[0.25em] text-zinc-600">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-zinc-400">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Parallel queues ---------- */}
        <section id="queues" className={`py-24 ${SNAP_SECTION}`}>
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <div>
              <div className="rf-sticker inline-flex items-center gap-2 px-4 py-1.5 text-sm">
                <Layers size={14} /> Parallel queues
              </div>
              <h2 className="mt-6 font-serif text-5xl font-normal leading-[1.02] md:text-6xl">
                Every opening,
                <br />
                at the same time.
              </h2>
              <p className="mt-6 text-lg leading-8 text-zinc-400">
                Each queue is one role: its job description, its requirements and its resumes. Open a
                queue per opening and they all run together, each with its own progress and ranking.
              </p>
              <ul className="mt-8 space-y-4 text-zinc-400">
                <li className="flex gap-3">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rotate-45 bg-pencil" />
                  <span>
                    <span className="font-bold text-zinc-200">Shared fairly.</span> Free screening slots
                    rotate between running queues, so a 200-resume queue never holds up a 10-resume one.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rotate-45 bg-pencil" />
                  <span>
                    <span className="font-bold text-zinc-200">Add resumes anytime.</span> New
                    applications join the back of the line, even while the queue is running.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rotate-45 bg-pencil" />
                  <span>
                    <span className="font-bold text-zinc-200">Pause, edit, re-score.</span> Pause a
                    queue, tighten its requirements, and re-score everyone against the new version.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rotate-45 bg-pencil" />
                  <span>
                    <span className="font-bold text-zinc-200">Backs off on its own.</span> If the server
                    asks it to slow down, it waits and carries on. Nothing is dropped.
                  </span>
                </li>
              </ul>
            </div>

            <div aria-hidden="true" className="rf-card rounded-3xl p-5 sm:p-6">
              <div className="space-y-5">
                {lanes.map((lane) => {
                  const paused = lane.cells.startsWith("p");
                  const done = [...lane.cells].filter((c) => c === "d").length;
                  return (
                    <div key={lane.name}>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-300">{lane.name}</span>
                        <span className="text-zinc-500">
                          {paused ? "Paused" : done === lane.cells.length ? "Complete" : "Screening"}
                        </span>
                      </div>
                      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                        {[...lane.cells].map((cell, i) => (
                          <span
                            key={i}
                            className={`aspect-square rounded-[3px] ${
                              cell === "d"
                                ? "bg-blue-500"
                                : cell === "a"
                                  ? "animate-pulse bg-marker"
                                  : cell === "p"
                                    ? "bg-amber-500/25"
                                    : "bg-white/[0.06]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/5 pt-4 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-blue-500" /> Scored</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-marker" /> In flight</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-white/[0.12]" /> Waiting</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-amber-500/40" /> Paused</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Scoring ---------- */}
        <section id="scoring" className={`py-24 ${SNAP_SECTION}`}>
          <div className="mx-auto max-w-5xl">
            <SectionHeading badge="Transparent scoring" title="100 points, and you can see every one">
              The same resume against the same requirements always gets the same score. Open any
              candidate to see which skills matched, which are missing, and where the evidence came from.
            </SectionHeading>
            <div className="rf-card overflow-hidden">
              {scoring.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-4 border-b border-white/5 px-5 py-4 last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)_3.5rem] sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-200">{row.label}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500 sm:hidden">{row.detail}</p>
                  </div>
                  <p className="hidden text-sm leading-6 text-zinc-400 sm:block">{row.detail}</p>
                  <p className="text-right font-serif text-3xl text-pencil">{row.points}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm text-zinc-500">
              Each card also shows the candidate&apos;s general ATS score, which reflects resume structure
              and parseability rather than fit for the role.
            </p>
          </div>
        </section>

        {/* ---------- Privacy & fairness ---------- */}
        <section id="privacy" className={`py-24 ${SNAP_SECTION}`}>
          <div className="mx-auto max-w-7xl">
            <SectionHeading badge="Privacy & fairness" title="Built to assist people, not replace them" />
            <div className="grid gap-5 sm:grid-cols-2">
              {principles.map((p) => (
                <div key={p.title} className="rf-card p-6">
                  <p.icon size={20} className="text-blue-400" />
                  <h3 className="mt-4 text-lg font-extrabold">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-zinc-400">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className={`py-24 ${SNAP_SECTION}`}>
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center font-serif text-5xl font-normal">Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rf-card shadow-[3px_3px_0_var(--shadow-color)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                    <span className="pr-4 text-lg font-bold">{faq.q}</span>
                    <ChevronDown size={20} className="shrink-0 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <p className="px-6 pb-6 leading-7 text-zinc-400">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA + footer ---------- */}
        {/* The footer lives inside the last snap section; after it, it could never be scrolled into view */}
        <section className="flex min-h-screen snap-start flex-col px-6">
          <div className="flex flex-1 items-center py-16">
          <div className="rf-card relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center">
            <h2 className="font-serif text-5xl font-normal leading-[1.02] md:text-6xl">Your next shortlist, sorted.</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-zinc-400">
              Open the workspace, create a queue for each role you&apos;re hiring for, and let them run.
            </p>
            <Link
              href="/business/screening"
              className="rf-btn rf-btn-primary mt-8 min-h-[56px] px-7 text-base"
            >
              Open the screening workspace <ArrowRight size={16} />
            </Link>
          </div>
          </div>

        {/* globals.css makes every footer a full-screen snap section; this one is nested in the last section */}
        <footer className="-mx-6 border-t border-white/10 px-6 py-10" style={{ minHeight: 0, scrollSnapAlign: "none" }}>
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-zinc-500 md:flex-row">
            <p>
              <span className="font-semibold text-white">ResumeForge</span> for Businesses · © 2026
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link href="/" className="transition hover:text-white">For job seekers</Link>
              <Link href="/analyzer" className="transition hover:text-white">Resume analyzer</Link>
              <Link href="/business/screening" className="transition hover:text-white">Screening workspace</Link>
            </div>
          </div>
        </footer>
        </section>
      </main>
    </>
  );
}
