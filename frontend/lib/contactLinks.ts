// ============================================================
// Supported platforms for link detection
// ============================================================

export interface PlatformInfo {
  label: string;
  patterns: RegExp[];
  usernameFromUrl: (url: string) => string;
  icon: string; // lucide icon name or custom
}

const PLATFORM_CONFIGS: Record<string, PlatformInfo> = {
  LinkedIn: {
    label: "LinkedIn",
    patterns: [
      /linkedin\.com\/in\/([^\/?#]+)/i,
      /linkedin\.com\/company\/([^\/?#]+)/i,
      /linkedin\.com\/school\/([^\/?#]+)/i,
    ],
    usernameFromUrl: (url: string): string => {
      for (const p of [/linkedin\.com\/in\/([^\/?#]+)/i, /linkedin\.com\/company\/([^\/?#]+)/i, /linkedin\.com\/school\/([^\/?#]+)/i]) {
        const m = url.match(p);
        if (m) return decodeURIComponent(m[1]);
      }
      return "";
    },
    icon: "Linkedin",
  },
  GitHub: {
    label: "GitHub",
    patterns: [
      /github\.com\/([^\/?#\s]+)/i,
    ],
    usernameFromUrl: (url: string): string => {
      const m = url.match(/github\.com\/([^\/?#\s]+)/i);
      return m ? m[1] : "";
    },
    icon: "Github",
  },
  Portfolio: {
    label: "Portfolio",
    patterns: [],
    usernameFromUrl: (_url: string): string => "",
    icon: "Globe",
  },
  "X (Twitter)": {
    label: "X (Twitter)",
    patterns: [
      /x\.com\/([^\/?#\s]+)/i,
      /twitter\.com\/([^\/?#\s]+)/i,
    ],
    usernameFromUrl: (url: string): string => {
      for (const p of [/x\.com\/([^\/?#\s]+)/i, /twitter\.com\/([^\/?#\s]+)/i]) {
        const m = url.match(p);
        if (m) return m[1];
      }
      return "";
    },
    icon: "Twitter",
  },
  LeetCode: {
    label: "LeetCode",
    patterns: [
      /leetcode\.com\/u\/([^\/?#\s]+)/i,
      /leetcode\.com\/([^\/?#\s]+)/i,
    ],
    usernameFromUrl: (url: string): string => {
      for (const p of [/leetcode\.com\/u\/([^\/?#\s]+)/i, /leetcode\.com\/([^\/?#\s]+)/i]) {
        const m = url.match(p);
        if (m) return m[1];
      }
      return "";
    },
    icon: "Code2",
  },
  Codeforces: {
    label: "Codeforces",
    patterns: [
      /codeforces\.com\/profile\/([^\/?#\s]+)/i,
    ],
    usernameFromUrl: (url: string): string => {
      const m = url.match(/codeforces\.com\/profile\/([^\/?#\s]+)/i);
      return m ? m[1] : "";
    },
    icon: "Code2",
  },
  HackerRank: {
    label: "HackerRank",
    patterns: [
      /hackerrank\.com\/(?:profile\/)?([^\/?#\s]+)/i,
    ],
    usernameFromUrl: (url: string): string => {
      const m = url.match(/hackerrank\.com\/(?:profile\/)?([^\/?#\s]+)/i);
      return m ? m[1] : "";
    },
    icon: "Code2",
  },
};

// ============================================================
// Detect platform from a URL string
// ============================================================

export function detectPlatform(url: string): string | null {
  const cleaned = url.trim();
  for (const [label, config] of Object.entries(PLATFORM_CONFIGS)) {
    if (label === "Portfolio") continue; // only match via patterns
    for (const pattern of config.patterns) {
      if (pattern.test(cleaned)) return label;
    }
  }
  // Fallback: guess from domain
  const domainMatch = cleaned.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
  if (domainMatch) {
    const domain = domainMatch[1].toLowerCase();
    for (const [label, config] of Object.entries(PLATFORM_CONFIGS)) {
      if (label === "Portfolio") continue;
      for (const pattern of config.patterns) {
        if (pattern.source.includes(domain.replace(/\./g, '\\.'))) return label;
      }
    }
  }
  return null;
}

// ============================================================
// Extract username from a known platform URL
// ============================================================

export function extractUsername(url: string, platformLabel: string): string {
  const config = PLATFORM_CONFIGS[platformLabel];
  if (!config) return "";
  return config.usernameFromUrl(url);
}

// ============================================================
// Normalize URL — ensure https:// prefix
// ============================================================

/**
 * Safely normalize an external URL for display and linking.
 *
 * - Trims whitespace
 * - Returns null if empty or invalid (never throws, never crashes)
 * - Prepends https:// if protocol is missing
 * - Wraps URL construction in try/catch
 * - Invalid URLs return null gracefully
 */
export function normalizeExternalUrl(value?: string): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;

  // If no protocol, prepend https://
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    // Validate by constructing a URL object
    new URL(withProtocol);
    return withProtocol;
  } catch {
    // URL construction failed — return null instead of crashing
    return null;
  }
}

export function normalizeUrl(value?: string): string {
  return normalizeExternalUrl(value) || "";
}

// ============================================================
// Get display label for a ResumeLink (username or domain)
// ============================================================

export function getLinkDisplay(link: { label: string; url: string; username?: string }): string {
  if (link.username) return link.username;
  const url = normalizeExternalUrl(link.url);
  if (!url) return link.label;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname;
  } catch {
    return link.label;
  }
}



// ============================================================
// ATS Contact Formatter — ordered, normalized, deduplicated
//
// Generates a contact line optimized for machine readability:
//   Phone | Email | Location | LinkedIn | GitHub | Portfolio
//
// Every value is normalized before rendering.
// Duplicates are detected and removed.
// Empty values are filtered out.
// ============================================================

export type ContactType =
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "github"
  | "portfolio"
  | "other";

export interface ATSContactEntry {
  /** What kind of contact this is — used to pick the header icon */
  type: ContactType;
  /** The normalized display text (machine-readable) */
  display: string;
  /** Optional clickable URL (null for phone/location) */
  href?: string;
}

/**
 * Normalize a URL to a clean display string without protocol.
 * Preserves the path/username portion.
 */
function normalizeLinkDisplay(href: string): string | null {
  try {
    const url = new URL(href);
    const hostname = url.hostname.replace(/^www\./, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return hostname + path;
  } catch {
    // Fallback: just strip protocol
    return href.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

/**
 * Normalize LinkedIn URL to linkedin.com/in/username
 */
function normalizeLinkedIn(url: string): string | null {
  const lower = url.toLowerCase();
  const match = lower.match(/linkedin\.com\/(?:in|company|school)\/([^\/?#&]+)/i);
  if (match) {
    return `linkedin.com/in/${match[1]}`;
  }
  return null;
}

/**
 * Normalize GitHub URL to github.com/username
 */
function normalizeGitHub(url: string): string | null {
  const lower = url.toLowerCase();
  const match = lower.match(/github\.com\/([^\/?#&\s]+)/i);
  if (match) {
    return `github.com/${match[1]}`;
  }
  return null;
}

/** Link labels treated as a personal website (globe icon) rather than a generic link. */
const PORTFOLIO_LABEL_PATTERN = /^(portfolio|website|personal (site|website)|homepage|blog)$/i;

/**
 * Build an ordered, normalized, deduplicated contact line for ATS rendering.
 *
 * Order: Phone → Email → Location → LinkedIn → GitHub → Portfolio
 *
 * Each value is normalized before rendering:
 *   - Email trimmed and lowercased
 *   - LinkedIn → linkedin.com/in/username
 *   - GitHub → github.com/username
 *   - Portfolio → clean domain/path without protocol
 *
 * Duplicates are detected by comparing normalized values.
 */
export function buildATSContactLine(profile: {
  email?: string;
  phone?: string;
  location?: string;
  links?: { label: string; url: string; username?: string }[];
}): ATSContactEntry[] {
  const result: ATSContactEntry[] = [];
  const seen = new Set<string>();

  function add(type: ContactType, display: string, href?: string) {
    const key = display.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({ type, display: display.trim(), href });
  }

  // 1. Phone — preserve user value, trim whitespace
  if (profile.phone?.trim()) {
    add("phone", profile.phone.trim());
  }

  // 2. Email — trim and lowercase for display
  if (profile.email?.trim()) {
    const email = profile.email.trim().toLowerCase();
    add("email", email, `mailto:${email}`);
  }

  // 3. Location — preserve user value
  if (profile.location?.trim()) {
    add("location", profile.location.trim());
  }

  // 4–6. Links — detect platform, normalize display, deduplicate
  const linkEntries: { type: ContactType; display: string; href: string; sortKey: number }[] = [];

  for (const link of profile.links || []) {
    const href = normalizeExternalUrl(link.url);
    if (!href) continue;

    let display: string | null = null;
    let sortKey = 99;
    let type: ContactType = "other";

    // Try LinkedIn
    display = normalizeLinkedIn(href);
    if (display) {
      sortKey = 1;
      type = "linkedin";
    }

    // Try GitHub
    if (!display) {
      display = normalizeGitHub(href);
      if (display) {
        sortKey = 2;
        type = "github";
      }
    }

    // Fallback: portfolio or other custom link (same sort position)
    if (!display) {
      display = normalizeLinkDisplay(href);
      if (display) {
        sortKey = 3;
        type = PORTFOLIO_LABEL_PATTERN.test(link.label.trim()) ? "portfolio" : "other";
      }
    }

    if (display) {
      linkEntries.push({ type, display, href, sortKey });
    }
  }

  // Sort: LinkedIn first, GitHub second, portfolio/other after
  linkEntries.sort((a, b) => a.sortKey - b.sortKey);

  // Deduplicate by normalized display
  const linkSeen = new Set<string>();
  for (const entry of linkEntries) {
    const key = entry.display.toLowerCase();
    if (linkSeen.has(key)) continue;
    linkSeen.add(key);
    add(entry.type, entry.display, entry.href);
  }

  return result;
}


