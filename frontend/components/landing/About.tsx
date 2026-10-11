"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "Is ResumeForge completely free?",
    answer:
      "Yes. ResumeForge is completely free to use. There are no subscriptions or mandatory sign-ups.",
  },
  {
    question: "Will my resume be stored?",
    answer:
      "No. Your resume is only processed for analysis. We don't permanently store your uploaded files.",
  },
  {
    question: "Can my hiring team use ResumeForge?",
    answer:
      "Yes. ResumeForge for Businesses screens a batch of resumes against a job description and ranks candidates with the same job-match scoring. Run a queue per opening, in parallel, with nothing stored on our servers.",
  },
  {
    question: "Which file formats are supported?",
    answer:
      "PDF and DOCX are supported for import and analysis. Legacy .doc files should be saved as .docx first.",
  },
  {
    question: "How accurate is the ATS score?",
    answer:
      "The ATS score combines keyword analysis and AI insights to highlight strengths and missing areas. It is designed to guide improvements rather than guarantee interview outcomes.",
  },
];

const highlights = [
  "Completely Free",
  "Privacy First",
  "ATS Optimized",
  "AI Powered",
];

export default function About() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="about"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24"
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-20 lg:grid-cols-[1fr_1.1fr]">
        {/* Left */}

        <div>
          <span className="rf-sticker px-4 py-1.5 text-sm">Why ResumeForge</span>

          <h2 className="mt-7 font-serif text-5xl font-normal leading-[1.02] md:text-6xl">
            Built for students,
            <br />
            graduates, and
            <br />
            <em className="rf-mark">job seekers.</em>
          </h2>

          <p className="mt-8 max-w-lg text-lg leading-8 text-zinc-400">
            ResumeForge was created because building a great resume
            should not require expensive subscriptions or generic AI
            responses. Everything is designed to help you build,
            optimize, and improve your resume with confidence.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {highlights.map((item) => (
              <div
                key={item}
                className="rf-card flex items-center gap-3 rounded-2xl px-5 py-4 shadow-[3px_3px_0_var(--shadow-color)]"
              >
                <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-pencil" aria-hidden="true" />

                <span className="font-semibold text-zinc-200">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}

        <div>
          <h3 className="mb-8 font-serif text-4xl font-normal">
            Questions, <em>answered</em>
          </h3>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={faq.question}
                className="rf-card overflow-hidden rounded-2xl shadow-[3px_3px_0_var(--shadow-color)]"
              >
                <button
                  onClick={() =>
                    setOpen(open === index ? null : index)
                  }
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="pr-4 text-lg font-bold">
                    {faq.question}
                  </span>

                  <ChevronDown
                    size={20}
                    className={`shrink-0 transition-transform duration-300 ${
                      open === index ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-300 ${
                    open === index
                      ? "grid-rows-[1fr]"
                      : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 leading-7 text-zinc-400">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}