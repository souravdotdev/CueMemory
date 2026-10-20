/** The URL `raw` names (resolved against `base` when given), or null when it isn't one. */
export function parsedUrl(raw: string, base?: string): URL | null {
  try {
    return new URL(raw, base);
  } catch {
    return null;
  }
}

/**
 * The http(s) URL a value names, trimmed and made absolute against `base` when
 * given, or null when it is blank, isn't a URL (a relative one without `base`)
 * or isn't http(s) (`data:`, `javascript:` …).
 */
export function httpUrl(value: string | null, base?: string): string | null {
  const trimmed = value?.trim();
  // A blank value would resolve to the base itself.
  if (!trimmed) return null;
  const url = parsedUrl(trimmed, base);
  return url && (url.protocol === "https:" || url.protocol === "http:") ? url.href : null;
}
