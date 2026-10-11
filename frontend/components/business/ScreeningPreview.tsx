// Static illustration of the screening workspace: queues as folder tabs and
// a sorted stack of candidates. Decorative — the data is made up.

const queues = [
  { name: "Backend Engineer", status: "42 / 60 screened" },
  { name: "Product Designer", status: "done" },
  { name: "Data Analyst", status: "9 / 35" },
];

const rows = [
  { name: "A. Rivera", score: 91, required: "9/9", missing: [] as string[] },
  { name: "J. Chen", score: 84, required: "8/9", missing: ["kafka"] },
  { name: "S. Okafor", score: 77, required: "7/9", missing: ["kafka", "terraform"] },
  { name: "M. Novak", score: 58, required: "5/9", missing: ["go", "kafka", "aws"] },
];

export default function ScreeningPreview({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`w-full ${className}`}>
      {/* Folder tabs */}
      <div className="flex gap-1.5 overflow-hidden px-1">
        {queues.map((q, i) => (
          <div
            key={q.name}
            className={`min-w-0 shrink rounded-t-xl border-2 border-b-0 border-line px-3 pb-2 pt-2 ${
              i === 0 ? "relative top-0.5 bg-panel" : "mt-1.5 bg-zinc-900"
            }`}
          >
            <div className="truncate text-xs font-extrabold sm:text-sm">{q.name}</div>
            <div className="truncate text-[10px] text-zinc-500 sm:text-[11px]">{q.status}</div>
          </div>
        ))}
      </div>

      {/* Folder body: the sorted stack */}
      <div className="rf-card rounded-tl-none p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-serif text-2xl sm:text-3xl">
            The stack, <em>sorted</em>
          </div>
          <span className="rf-hand text-lg">4 ranked</span>
        </div>
        <ol className="mt-3 space-y-2">
          {rows.map((r, i) => {
            const low = r.score < 60;
            return (
              <li
                key={r.name}
                className="flex items-center gap-3 rounded-xl border-2 border-line bg-panel px-3 py-2 shadow-[2px_2px_0_var(--shadow-color)]"
              >
                <span className="w-5 font-serif text-2xl leading-none">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{r.name}</span>
                <span className="hidden text-xs font-bold sm:inline">{r.required}</span>
                <span className="hidden min-w-0 truncate text-xs text-pencil line-through decoration-2 sm:inline">
                  {r.missing.join(" · ")}
                </span>
                <span
                  className={`rf-score h-10 w-10 shrink-0 text-xl shadow-none ${
                    low ? "rf-score--low rotate-6" : "rf-score--good -rotate-6"
                  }`}
                >
                  {r.score}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="rf-note mt-4 -rotate-1 px-4 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em]">AI brief · A. Rivera</div>
          <p className="mt-1 text-xs leading-relaxed sm:text-sm">
            Every required skill shows up in a job or project, not just the skills list. Worth asking who owned
            the on-call rotation.
          </p>
        </div>
      </div>
    </div>
  );
}
