const SHEET = "M12 7h25l13 13v34a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4z";

/**
 * The ResumeForge mark: a tilted resume sheet with a highlighted line and a forge spark.
 * Fixed sticker colours in both themes (like .rf-note). Inside a `group` link it
 * straightens and the spark turns on hover — see .rf-logo-* in globals.css.
 * Keep in sync with app/icon.svg.
 */
export default function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 overflow-visible ${className}`} aria-hidden="true" focusable="false">
      <g transform="rotate(-7 29 33)">
        <g className="rf-logo-sheet">
          <path transform="translate(4 4)" d={SHEET} fill="#1f1b16" />
          <path d={SHEET} fill="#fffdf8" stroke="#1f1b16" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M37 7v9a4 4 0 0 0 4 4h9" fill="none" stroke="#1f1b16" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M11.5 32.5l31-1.6.7 9.4-31 1.6z" fill="#ffd84d" />
          <path d="M16 25h14M16 36.5h21M16 48h11" stroke="#1f1b16" strokeWidth="4.2" strokeLinecap="round" />
        </g>
      </g>
      <path
        className="rf-logo-spark"
        d="M53 2.5l3 7.6 7 2.9-7 2.9-3 7.6-3-7.6-7-2.9 7-2.9z"
        fill="#bf3119"
        stroke="#1f1b16"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
