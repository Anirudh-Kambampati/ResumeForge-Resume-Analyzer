"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const audience = [
  "Students",
  "Graduates",
  "Developers",
  "Designers",
  "Interns",
  "Career Switchers",
  "Professionals",
  "Job Seekers",
  "Everyone",
];

export default function Hero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIndex((prev) => (prev + 1) % audience.length);
    }, audience[index] === "Everyone" ? 4000 : 2400);

    return () => clearTimeout(timeout);
  }, [index]);

  return (
    <section
      id="hero"
      className="relative flex min-h-screen snap-start items-start justify-center overflow-hidden px-6 pt-16 md:pt-20"
    >
      {/* Glow */}
      <div className="absolute left-1/2 top-[38%] -z-10 h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[150px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center pt-4">
        {/* Badge */}
        <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 backdrop-blur-xl">
          ✨ Build • Analyze • Improve
        </div>

        {/* Heading */}
        <h1 className="mt-5 max-w-5xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Forge resumes
          <br />
          <span className="bg-gradient-to-r from-white via-blue-200 to-blue-500 bg-clip-text text-transparent">
            that get interviews.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400 md:text-xl">
          Build professional resumes from scratch or analyze your existing
          resume against any job description using AI. Improve your ATS score,
          strengthen your experience, and prepare confidently for interviews.
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/builder"
            className="rounded-2xl bg-blue-600 px-8 py-4 text-base font-medium transition-all duration-300 hover:scale-[1.02] hover:bg-blue-500"
          >
            Build Resume
          </Link>

          <Link
            href="/analyzer"
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-medium backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/40 hover:bg-white/[0.05]"
          >
            Analyze Resume
          </Link>
        </div>

        {/* Built For */}
        <div className="mt-14 flex flex-col items-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.4em] text-zinc-500">
            BUILT FOR
          </p>
          <div className="relative flex h-16 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.h2
                key={audience[index]}
                initial={{
                  opacity: 0,
                  y: 20,
                  filter: "blur(10px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: -20,
                  filter: "blur(10px)",
                }}
                transition={{
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="bg-gradient-to-r from-white via-blue-200 to-blue-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-5xl"
              >
                {audience[index]}.
              </motion.h2>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}