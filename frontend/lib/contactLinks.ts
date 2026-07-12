export function normalizeUrl(value?: string): string {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function normalizeEmail(value?: string): string {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  return /^mailto:/i.test(trimmed) ? trimmed : `mailto:${trimmed}`;
}
