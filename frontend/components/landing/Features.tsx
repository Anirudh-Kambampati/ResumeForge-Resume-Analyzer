const features = [
  {
    number: "01",
    title: "Resume Builder",
    description:
      "Create professional resumes with a clean, intuitive editor built for speed.",
  },
  {
    number: "02",
    title: "ATS Analysis",
    description:
      "Compare your resume against any job description and uncover missing keywords.",
  },
  {
    number: "03",
    title: "AI Suggestions",
    description:
      "Strengthen every section with intelligent, context-aware improvements.",
  },
  {
    number: "04",
    title: "Interview Prep",
    description:
      "Generate personalized interview questions based on your resume and role.",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20"
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* Heading */}

        <div className="mb-12 text-center">
          <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 backdrop-blur-xl">
            ✨ Everything you need
          </div>

          <h2 className="mt-5 text-5xl font-bold tracking-tight md:text-6xl">
            One platform.
            <br />
            Every advantage.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            Build, optimize and perfect your resume with tools designed
            to help you stand out in today&apos;s hiring process.
          </p>
        </div>

        {/* Cards */}

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.number}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tracking-[0.25em] text-blue-400">
                  {feature.number}
                </span>

                <h3 className="text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
              </div>

              <p className="mt-3 text-[15px] leading-7 text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}