// ============================================================
// Project Link Classification
//
// Maps project URLs to semantic labels so resumes never show
// raw URLs. Every link becomes either a known platform name
// (GitHub, GitLab, Bitbucket) or "Live Demo".
//
// Single source of truth for all renderers (PDF, web preview).
// ============================================================

// ============================================================
// Known code-hosting platforms → platform name label
// ============================================================

const CODE_HOST_PATTERNS: Record<string, RegExp[]> = {
  GitHub: [/github\.com/i],
  GitLab: [/gitlab\.com/i],
  Bitbucket: [/bitbucket\.org/i],
};

// ============================================================
// Known deployment platforms → "Live Demo"
// ============================================================

const DEPLOY_PLATFORM_PATTERNS = [
  /vercel\.app/i,
  /netlify\.app/i,
  /pages\.dev/i,
  /render\.com/i,
];

// ============================================================
// classifyProjectLink — return the semantic label for a URL
//
// Returns one of:
//   "GitHub", "GitLab", "Bitbucket", "Live Demo"
//
// Never returns an empty string. Every URL maps to a label.
// ============================================================

function classifyProjectLink(url: string): string {
  // 1. Known code-hosting platforms → platform name
  for (const [label, patterns] of Object.entries(CODE_HOST_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) return label;
    }
  }

  // 2. Known deployment platforms → "Live Demo"
  for (const pattern of DEPLOY_PLATFORM_PATTERNS) {
    if (pattern.test(url)) return "Live Demo";
  }

  // 3. Everything else (custom domains, raw IPs, etc.) → "Live Demo"
  return "Live Demo";
}

// ============================================================
// Project link info — structured result with label + normalized URL
// ============================================================

export interface ProjectLinkInfo {
  /** Normalized clickable URL (safe for Link src) */
  href: string;
  /** Semantic display label (e.g. "GitHub", "Live Demo") */
  label: string;
}

/**
 * Build ProjectLinkInfo from a raw project link string.
 * Returns null for empty / falsy links so callers can do
 * concise null checks without placeholder handling.
 */
export function getProjectLinkInfo(link?: string): ProjectLinkInfo | null {
  if (!link || !link.trim()) return null;

  const trimmed = link.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    new URL(withProtocol); // validate
    return {
      href: withProtocol,
      label: classifyProjectLink(trimmed),
    };
  } catch {
    // Invalid URL — return null, caller renders nothing
    return null;
  }
}


