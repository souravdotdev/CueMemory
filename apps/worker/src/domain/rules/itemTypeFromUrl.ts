import type { ItemType } from "@/domain/entities/Item";

interface UrlRule {
  type: ItemType;
  matches(host: string, path: string): boolean;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

// In order; the first match wins. Hosts are lower-case, without `www.` or `m.`.
// Paths are the URL's path only, never its query or fragment.
const URL_RULES: readonly UrlRule[] = [
  {
    // A post on X: /<user>/status/<id>
    type: "tweet",
    matches: (host, path) =>
      (host === "x.com" || host === "twitter.com") && /^\/[^/]+\/status\/\d+(\/|$)/.test(path),
  },
  {
    type: "video",
    matches: (host, path) =>
      (host === "youtube.com" && /^\/(watch\/?$|shorts\/|live\/)/.test(path)) ||
      (host === "youtu.be" && /^\/[^/]+/.test(path)),
  },
  {
    // Instagram reels
    type: "video",
    matches: (host, path) => host === "instagram.com" && /^\/reels?\//.test(path),
  },
  {
    // Instagram posts
    type: "image",
    matches: (host, path) => host === "instagram.com" && path.startsWith("/p/"),
  },
  {
    // Reddit threads
    type: "article",
    matches: (host, path) =>
      (host === "reddit.com" && /^\/r\/[^/]+\/comments\//.test(path)) ||
      (host === "redd.it" && /^\/[^/]+/.test(path)),
  },
  { type: "pdf", matches: (_host, path) => /\.pdf$/i.test(path) },
  { type: "image", matches: (_host, path) => IMAGE_EXTENSIONS.test(path) },
];

/**
 * Works out an Item type from the Source URL's shape alone, without fetching
 * it. Returns null when no rule recognises the URL: the caller decides what an
 * unrecognised URL becomes.
 */
export function itemTypeFromUrl(sourceUrl: string): ItemType | null {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const rule = URL_RULES.find((candidate) => candidate.matches(host, url.pathname));
  return rule?.type ?? null;
}
