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
    question: "Which file formats are supported?",
    answer:
      "PDF is currently supported. DOCX support is planned in a future update.",
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
          <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 backdrop-blur-xl">
            Why ResumeForge
          </div>

          <h2 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Built for students,
            <br />
            graduates, and
            <br />
            job seekers.
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
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl"
              >
                <div className="h-2 w-2 rounded-full bg-blue-400" />

                <span className="text-zinc-200">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}

        <div>
          <h3 className="mb-8 text-3xl font-bold tracking-tight">
            Frequently Asked Questions
          </h3>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.05]"
              >
                <button
                  onClick={() =>
                    setOpen(open === index ? null : index)
                  }
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="pr-4 text-lg font-medium">
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