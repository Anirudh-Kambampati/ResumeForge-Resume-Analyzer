import Link from "next/link";

export default function ImportPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6">
      <div className="mx-auto max-w-lg text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-400"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Resume Import
        </h1>

        <p className="mt-4 text-base leading-7 text-zinc-400">
          Resume Import is coming soon.
        </p>

        <p className="mt-2 text-sm leading-6 text-zinc-600">
          This page will eventually handle:
        </p>

        <ul className="mx-auto mt-4 inline-block space-y-2 text-left text-sm leading-6 text-zinc-500">
          <li className="flex items-center gap-2.5">
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            Resume upload
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            Parsing
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            ResumeData generation
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            Validation
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            Redirect to Builder
          </li>
        </ul>

        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-zinc-200 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.06] hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l-4-4 4-4" />
          </svg>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
