const features = [
  {
    number: "01",
    title: "Resume builder",
    description:
      "A clean, fast editor with a live preview and layouts that applicant tracking systems can read.",
    tilt: "-rotate-1",
  },
  {
    number: "02",
    title: "ATS check",
    description:
      "Hold your resume up to any job description and see which keywords are missing.",
    tilt: "rotate-[0.8deg]",
  },
  {
    number: "03",
    title: "Red-pencil rewrites",
    description:
      "Line-by-line suggestions that sharpen the wording and never invent facts.",
    tilt: "-rotate-[0.6deg]",
  },
  {
    number: "04",
    title: "Interview prep",
    description:
      "Questions drawn from your own resume and the role you're going for.",
    tilt: "rotate-1",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pb-16 pt-28"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-serif text-5xl font-normal leading-none md:text-6xl">
            One desk. <em>Every tool.</em>
          </h2>
          <span className="rf-hand inline-block -rotate-3 text-[28px]">(all of it free)</span>
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Build it, check it against the job, fix what the red pencil finds, and practise the questions it
          raises.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.number}
              className={`rf-card px-6 pb-7 pt-6 transition-transform duration-300 hover:rotate-0 ${feature.tilt}`}
            >
              <div className="font-serif text-4xl italic leading-none text-pencil">{feature.number}</div>
              <h3 className="mb-2 mt-4 text-xl font-extrabold">{feature.title}</h3>
              <p className="text-[15px] leading-7 text-zinc-400">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
