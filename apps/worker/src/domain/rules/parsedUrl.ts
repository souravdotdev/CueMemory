/** The URL `raw` names (resolved against `base` when given), or null when it isn't one. */
export function parsedUrl(raw: string, base?: string): URL | null {
  try {
    return new URL(raw, base);
  } catch {
    return null;
  }
}
