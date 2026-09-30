"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FilePlus, Upload } from "lucide-react";
import { useEffect, useCallback } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 12,
    transition: { duration: 0.2, ease: "easeOut" },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.08,
      duration: 0.35,
      ease: "easeOut" as const,
    },
  }),
};

export default function OnboardingModal({ isOpen, onClose }: Props) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleCreateNew = () => {
    onClose();
    router.push("/builder");
  };

  const handleImport = () => {
    onClose();
    router.push("/import");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-heading"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/[0.06] bg-panel p-8 shadow-2xl shadow-black/50 sm:p-10"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition-colors hover:bg-white/[0.08] hover:text-zinc-300"
              aria-label="Close modal"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>

            {/* Heading */}
            <div className="mb-8 text-center sm:mb-10">
              <h2
                id="onboarding-heading"
                className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
              >
                How would you like to start?
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500 sm:text-base">
                Choose how you&apos;d like to begin building your resume.
              </p>
            </div>

            {/* Cards */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              {/* Create New Resume */}
              <motion.button
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                onClick={handleCreateNew}
                className="group relative flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 transition-all duration-300 group-hover:bg-blue-500/15 group-hover:text-blue-300 group-hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]">
                  <FilePlus size={28} strokeWidth={1.5} />
                </div>

                <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-white">
                  Create New Resume
                </h3>

                <p className="mb-6 text-sm leading-6 text-zinc-500">
                  Start with a blank ATS-friendly resume.
                </p>

                <span className="mt-auto inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-on-accent transition-all duration-300 group-hover:bg-blue-500 shadow-lg shadow-blue-600/10">
                  Start Building
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <path d="M5 3l4 4-4 4" />
                  </svg>
                </span>
              </motion.button>

              {/* Import Existing Resume */}
              <motion.button
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={1}
                onClick={handleImport}
                className="group relative flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 transition-all duration-300 group-hover:bg-blue-500/15 group-hover:text-blue-300 group-hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]">
                  <Upload size={28} strokeWidth={1.5} />
                </div>

                <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-white">
                  Import Existing Resume
                </h3>

                <p className="mb-6 text-sm leading-6 text-zinc-500">
                  Upload an existing resume and automatically populate the
                  Builder.
                </p>

                <span className="mt-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-zinc-200 backdrop-blur-xl transition-all duration-300 group-hover:border-blue-500/30 group-hover:bg-white/[0.06] group-hover:text-white">
                  Import Resume
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <path d="M5 3l4 4-4 4" />
                  </svg>
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
