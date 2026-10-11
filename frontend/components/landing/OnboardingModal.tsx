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
          className="rf-card relative z-10 w-full max-w-2xl rounded-3xl p-8 shadow-[6px_6px_0_var(--shadow-color)] sm:p-10"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Close button */}
          <button
            onClick={onClose}
              className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-line bg-panel text-white transition hover:bg-marker hover:text-[#1f1b16]"
              aria-label="Close modal"
              autoFocus
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
                className="font-serif text-4xl font-normal text-white sm:text-5xl"
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
                className="group rf-card relative flex flex-col items-center p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:-rotate-1"
              >
                <div className="mb-5 flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl border-2 border-line bg-marker text-[#1f1b16] shadow-[3px_3px_0_var(--shadow-color)]">
                  <FilePlus size={28} strokeWidth={1.5} />
                </div>

                <h3 className="mb-1.5 text-lg font-extrabold text-white">
                  Create New Resume
                </h3>

                <p className="mb-6 text-sm leading-6 text-zinc-500">
                  Start with a blank ATS-friendly resume.
                </p>

                <span className="rf-btn rf-btn-primary mt-auto gap-1.5 px-5 text-sm">
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
                className="group rf-card relative flex flex-col items-center p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:-rotate-1"
              >
                <div className="mb-5 flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl border-2 border-line bg-marker text-[#1f1b16] shadow-[3px_3px_0_var(--shadow-color)]">
                  <Upload size={28} strokeWidth={1.5} />
                </div>

                <h3 className="mb-1.5 text-lg font-extrabold text-white">
                  Import Existing Resume
                </h3>

                <p className="mb-6 text-sm leading-6 text-zinc-500">
                  Upload an existing resume and automatically populate the
                  Builder.
                </p>

                <span className="rf-btn mt-auto gap-1.5 px-5 text-sm">
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
