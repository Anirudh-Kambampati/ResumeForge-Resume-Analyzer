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

export function normalizeEmail(value?: string): string {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  return /^mailto:/i.test(trimmed) ? trimmed : `mailto:${trimmed}`;
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
// Known platform labels list
// ============================================================

export const KNOWN_PLATFORM_LABELS = Object.keys(PLATFORM_CONFIGS);

export const KNOWN_PLATFORMS = Object.values(PLATFORM_CONFIGS).map((p) => ({
  label: p.label,
  icon: p.icon,
}));

// ============================================================
// Build a complete contact row object for rendering
// For each link, determine what to display and where to link.
// ============================================================

export interface ContactItem {
  type: "email" | "phone" | "location" | "link";
  label: string;
  href?: string;
  icon?: string;
  platformLabel?: string; // lucide icon name for link items
}

export function buildContactItems(profile: {
  email?: string;
  phone?: string;
  location?: string;
  links?: { label: string; url: string; username?: string }[];
}): ContactItem[] {
  const items: ContactItem[] = [];

  if (profile.email) {
    items.push({ type: "email", label: profile.email, href: normalizeEmail(profile.email) });
  }
  if (profile.phone) {
    items.push({ type: "phone", label: profile.phone });
  }
  if (profile.location) {
    items.push({ type: "location", label: profile.location });
  }
  for (const link of profile.links || []) {
    const href = normalizeExternalUrl(link.url);
    if (href) {
      const platform = detectPlatform(href);
      // Extract username from URL for display, even if the editor
      // stored the raw URL without extracting a username.
      const displayLabel = link.username
        || (platform ? extractUsername(href, platform) : "")
        || getLinkDisplay(link);
      items.push({
        type: "link",
        label: displayLabel,
        href,
        platformLabel: link.label,
        icon: platform || undefined,
      });
    }
  }

  return items;
}
