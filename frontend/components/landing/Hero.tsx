"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const OnboardingModal = dynamic(() => import("./OnboardingModal"));

const audience = [
  "students",
  "graduates",
  "developers",
  "designers",
  "interns",
  "career switchers",
  "professionals",
  "job seekers",
  "recruiters",
  "hiring teams",
  "everyone",
];

/** A resume page with red-pencil markup, the score sticker and a sticky note. */
function MarkedUpSheet() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[500px]">
      <div className="rotate-[1.4deg] rounded-md border-[1.5px] border-zinc-800 bg-panel px-8 py-9 shadow-[0_1px_0_var(--color-zinc-800),0_30px_50px_-28px_rgba(70,45,15,.45)] sm:px-10">
        <div className="font-serif text-4xl leading-none">Jane Smith</div>
        <div className="mt-1.5 text-[13px] text-zinc-500">Product Designer · Brooklyn, NY · jane.smith@gmail.com</div>
        <div className="mb-4 mt-[18px] h-[1.5px] bg-line" />
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em]">Experience</div>
        <div className="mt-2.5 flex justify-between gap-3 text-sm">
          <span className="font-bold">Senior Product Designer, Spotify</span>
          <span className="text-zinc-500">2021 – now</span>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-[18px] text-[13.5px] leading-[1.7] text-zinc-200">
          <li>
            <span className="line-through decoration-pencil decoration-2">Responsible for the</span>{" "}
            <span className="rf-hand text-[21px]">Led the</span> redesign of the playlist editor, lifting weekly
            edits by 18%.
          </li>
          <li>
            Partnered with engineering squads to ship a shared design system.
            <span className="rf-hand block -rotate-1 text-xl">↳ how many squads? numbers stick</span>
          </li>
        </ul>
        <div className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.14em]">Skills</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px]">
          <span>Figma</span>
          <span>·</span>
          <span>Prototyping</span>
          <span>·</span>
          <span className="-rotate-3 rounded-[50%] border-2 border-pencil px-2.5 py-1">Usability testing</span>
          <span className="rf-hand text-xl">← the job asks for this. Move it up!</span>
        </div>
      </div>

      {/* Score sticker */}
      <div className="rf-score rf-score--good absolute -top-6 right-2 h-28 w-28 rotate-[9deg] flex-col">
        <span className="font-sans text-[11px] font-extrabold tracking-[0.12em]">ATS</span>
        <span className="text-[46px]">86</span>
        <span className="font-sans text-[11px] font-semibold">/ 100</span>
      </div>

      {/* Sticky note */}
      <div className="rf-card absolute -bottom-16 -left-2 -rotate-[4deg] sm:-left-6 rounded-[4px] px-4 py-3 font-hand text-2xl font-bold leading-[1.1]">
        3 quick fixes
        <br />
        before you send it
      </div>
    </div>
  );
}

export default function Hero() {
  const [index, setIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const onOpen = () => setShowModal(true);
  const onClose = () => setShowModal(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIndex((prev) => (prev + 1) % audience.length);
    }, audience[index] === "everyone" ? 4000 : 2400);

    return () => clearTimeout(timeout);
  }, [index]);

  return (
    <section id="hero" className="relative flex min-h-screen snap-start items-center px-6 pb-16 pt-28">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-16">
        <div className="min-w-0 flex-[1_1_480px]">
          <span className="rf-sticker px-4 py-1.5 text-sm">Build · Analyze · Improve</span>

          <h1 className="mt-7 font-serif text-[clamp(56px,8vw,96px)] font-normal leading-[0.98] tracking-[-0.015em]">
            Forge a resume that gets <em className="rf-mark">read.</em>
          </h1>
          <p className="rf-hand ml-1 mt-3 origin-left -rotate-[1.5deg] text-[28px] sm:text-[30px]">
            by recruiters, and by the robots before them ↑
          </p>

          <p className="mt-5 max-w-[520px] text-lg leading-8 text-zinc-400">
            Write a resume from scratch, or check the one you have against any job description. See exactly what
            to fix, line by line, and walk into the interview ready.
          </p>

          <div className="mt-8 flex flex-wrap gap-3.5">
            <button onClick={onOpen} className="rf-btn rf-btn-primary min-h-[56px] px-7 text-[17px]">
              Build my resume <ArrowRight size={18} />
            </button>
            <Link href="/analyzer" className="rf-btn min-h-[56px] px-7 text-[17px]">
              Check my resume
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-zinc-500">Built for</span>
            <span className="relative inline-flex h-10 min-w-[12ch] items-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={audience[index]}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="font-serif text-3xl italic"
                >
                  {audience[index]}.
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <Link
            href="/business"
            className="group mt-4 inline-flex flex-wrap items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Hiring? Screen every applicant with
            <span className="font-semibold text-pencil underline decoration-2 underline-offset-4 group-hover:decoration-wavy">
              ResumeForge for Businesses →
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-[1_1_420px] justify-center py-8">
          <MarkedUpSheet />
        </div>
      </div>

      <OnboardingModal isOpen={showModal} onClose={onClose} />
    </section>
  );
}
