"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";

// A few index cards from a sorted stack (made-up sample data). Tap one to see why it ranked there.
const stack = [
  { rank: 1, name: "A. Rivera", score: 91, tilt: "-rotate-[1.5deg]", required: "9/9", missing: [] as string[] },
  { rank: 2, name: "J. Chen", score: 84, tilt: "rotate-[0.8deg]", required: "8/9", missing: ["kafka"] },
  { rank: 3, name: "M. Novak", score: 58, tilt: "-rotate-[0.4deg]", required: "5/9", missing: ["go", "kafka", "aws"] },
];

export default function CandidateStack() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-w-0 flex-[1_1_340px] flex-col p-2">
        <p className="rf-hand mb-2 ml-1 -rotate-1 text-xl text-pencil">tap a card to see why it ranked there ↓</p>
        <ol className="flex flex-col gap-3">
          {stack.map((card) => {
            const low = card.score < 60;
            const isOpen = open === card.rank;
            return (
              <li key={card.rank}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : card.rank)}
                  aria-expanded={isOpen}
                  className={`
                    w-full rounded-xl bg-panel px-5 py-4 text-left text-white transition-transform duration-200
                    hover:rotate-0 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil
                    ${isOpen ? "rotate-0 -translate-y-0.5" : card.tilt}
                  `}
                >
                  <span className="flex items-center gap-4">
                    <span className="w-6 font-serif text-3xl">{card.rank}</span>
                    <span className="flex-1 font-bold">{card.name}</span>
                    <span
                      className={`rf-score h-12 w-12 text-2xl shadow-none ${low ? "rf-score--low -rotate-6" : "rf-score--good rotate-3"}`}
                      aria-label={`score ${card.score}`}
                    >
                      {card.score}
                    </span>
                  </span>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.span
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="block overflow-hidden"
                      >
                        <span
                          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pl-10 pt-3 text-sm"
                          style={{ borderColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
                        >
                          <span className="font-bold">{card.required} required skills</span>
                          {card.missing.length === 0 ? (
                            <span className="opacity-70">nothing missing</span>
                          ) : (
                            <span className="text-pencil line-through decoration-2">{card.missing.join(" · ")}</span>
                          )}
                        </span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </MotionConfig>
  );
}
