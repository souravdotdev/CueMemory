export const MAX_TAG_NAME_LENGTH = 50;

// What a canonical slug looks like: runs of a-z 0-9 + # . joined by single hyphens.
// A string (not a RegExp) so the database CHECK on tags.name can embed it verbatim.
export const TAG_NAME_PATTERN = "^[a-z0-9+#.]+(-[a-z0-9+#.]+)*$";

export type SlugifyTagNameResult =
  { ok: true; slug: string } | { ok: false; reason: "empty" | "too-long" };

// Turns an AI-suggested or User-typed Tag name into its canonical slug, or rejects it.
export function slugifyTagName(name: string): SlugifyTagNameResult {
  const slug = name
    .toLowerCase()
    .replace(/[\s_]/g, "-")
    .replace(/[^a-z0-9+#.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug === "") return { ok: false, reason: "empty" };
  if (slug.length > MAX_TAG_NAME_LENGTH) return { ok: false, reason: "too-long" };
  return { ok: true, slug };
}
