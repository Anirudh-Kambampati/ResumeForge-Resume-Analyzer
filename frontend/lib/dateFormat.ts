// ============================================================
// Date Normalization — consistent date formatting across resumes
//
// Normalizes all date strings to "Mon YYYY" format (e.g. "Jun 2027").
// Preserves special keywords: Present, Expected.
// Normalizes "Current" → "Present".
// Does NOT infer missing dates — only reformats what's given.
// ============================================================

// Month aliases: full names, abbreviations, and numeric → 3-letter abbreviation
const _MONTH_ALIASES: Record<string, string> = {
  jan: "Jan", january: "Jan",
  feb: "Feb", february: "Feb",
  mar: "Mar", march: "Mar",
  apr: "Apr", april: "Apr",
  may: "May",
  jun: "Jun", june: "Jun",
  jul: "Jul", july: "Jul",
  aug: "Aug", august: "Aug",
  sep: "Sep", september: "Sep",
  oct: "Oct", october: "Oct",
  nov: "Nov", november: "Nov",
  dec: "Dec", december: "Dec",
};

/** Map numeric month (1–12) to 3-letter abbreviation. */
function _monthNumToAbbrev(n: number): string {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][n - 1] ?? "";
}

/** Parse a month name/abbreviation to its 3-letter canonical form, or null. */
function _normalizeMonth(word: string): string | null {
  return _MONTH_ALIASES[word.toLowerCase()] ?? null;
}

// Regex patterns (compiled once)
const _SINGLE_DATE_RE = /^(\d{1,2})\/(\d{4})$/;          // 06/2027
const _MONTH_YEAR_RE  = /^([A-Za-z]+)\s+(\d{4})$/;        // Jun 2027 or June 2027
const _YEAR_ONLY_RE   = /^(\d{4})$/;                       // 2027
const _DURATION_SEP_RE = /\s*(?:–|-|—|to)\s*/i;            // separator in date ranges// ============================================================// normalizeSingleDate — normalize ONE date string
//
// Handles:
//   "Jun 2027"     → "Jun 2027"
//   "June 2027"    → "Jun 2027"
//   "06/2027"      → "Jun 2027"
//   "2027"         → "2027"
//   "Present"      → "Present"
//   "Current"      → "Present"
//   "Expected Jun 2027" → "Expected Jun 2027"
//   ""             → ""
// ============================================================

export function normalizeSingleDate(date?: string): string {
  if (!date) return "";
  const text = date.trim();
  if (!text) return "";

  // 1. Check for known special keywords first
  const lower = text.toLowerCase();
  if (lower === "present" || lower === "current") return "Present";
  if (lower === "expected") return "Expected";

  // 2. Check for "Expected <date>" prefix
  let prefix = "";
  let body = text;
  const expectedMatch = text.match(/^expected\s+/i);
  if (expectedMatch) {
    prefix = "Expected ";
    body = text.slice(expectedMatch[0].length).trim();
  }

  // 3. Try MM/YYYY
  const slashMatch = body.match(_SINGLE_DATE_RE);
  if (slashMatch) {
    const monthNum = parseInt(slashMatch[1], 10);
    const year = slashMatch[2];
    if (monthNum >= 1 && monthNum <= 12) {
      return prefix + `${_monthNumToAbbrev(monthNum)} ${year}`;
    }
    // Invalid month number — return body as-is
    return prefix + body;
  }

  // 4. Try "Month YYYY"
  const monthYearMatch = body.match(_MONTH_YEAR_RE);
  if (monthYearMatch) {
    const canonical = _normalizeMonth(monthYearMatch[1]);
    if (canonical) {
      return prefix + `${canonical} ${monthYearMatch[2]}`;
    }
  }

  // 5. Try just "YYYY"
  if (_YEAR_ONLY_RE.test(body)) {
    return prefix + body;
  }

  // 6. Fallback — return original with any prefix
  return prefix + body;
}

// ============================================================
// normalizeDate — normalize a single date OR an entire duration
// range string (e.g. "June 2023 – Present")
//
// Handles:
//   "June 2023 – Present"     → "Jun 2023 – Present"
//   "June 2023 - June 2025"  → "Jun 2023 – Jun 2025"
//   "June 2023 — June 2025"  → "Jun 2023 – Jun 2025"
//   "Jun 2023 to Present"    → "Jun 2023 – Present"
//   "Expected June 2027"     → "Expected Jun 2027"
// ============================================================

// ============================================================
// formatDateRange — format a start/end date pair into a display range.
//
// Handles:
//   "Jan 2023", "Dec 2022", false    → "Jan 2023 – Dec 2022"
//   "Jan 2023", "", true             → "Jan 2023 – Present"
//   "", "", false                     → ""
//   "2020", "2023", false             → "2020 – 2023"
//
// Used by both the web preview and PDF renderer.
// ============================================================

export function formatDateRange(start?: string, end?: string, current?: boolean): string {
  const s = normalizeDate(start);
  const e = current ? "Present" : normalizeDate(end);
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} \u2013 ${e}`;
}

export function normalizeDate(date?: string): string {
  if (!date) return "";
  const text = date.trim();
  if (!text) return "";

  // Try splitting on common range separators
  const parts = text.split(_DURATION_SEP_RE);
  if (parts.length >= 2) {
    const normalized = parts
      .map((p) => p.trim())
      .filter(Boolean)
      .map(normalizeSingleDate);
    return normalized.join(" – ");
  }

  // Single date — just normalize
  return normalizeSingleDate(text);
}
