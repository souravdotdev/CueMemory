import type { ItemType } from "@/domain/entities/Item";
import type { FetchedPage } from "@/domain/providers/IUrlFetcher";
import { itemTypeFromContentType } from "@/domain/rules/itemTypeFromContentType";
import { itemTypeFromMagicBytes } from "@/domain/rules/itemTypeFromMagicBytes";
import { mediaTypeOf } from "@/domain/rules/mediaType";

const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** The value of the page's `og:type` meta tag, lower-case, or null without one. */
function openGraphType(htmlHead: string): string | null {
  for (const [tag] of htmlHead.matchAll(META_TAG)) {
    const attributes = new Map<string, string>();
    for (const [, name, doubleQuoted, singleQuoted, bare] of tag.matchAll(ATTRIBUTE)) {
      attributes.set(name!.toLowerCase(), doubleQuoted ?? singleQuoted ?? bare ?? "");
    }
    const key = (attributes.get("property") ?? attributes.get("name"))?.toLowerCase();
    if (key === "og:type") return attributes.get("content")?.trim().toLowerCase() ?? null;
  }
  return null;
}

// Content-Types that say only "some bytes": the first bytes decide instead.
const VAGUE_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/**
 * Works out an Item type from a fetched page: a non-HTML response by its
 * Content-Type, or by its magic bytes when the Content-Type is missing or
 * vague; an Article when an HTML page's head declares `og:type` article; and
 * a Link otherwise.
 */
export function itemTypeFromResponse(page: FetchedPage): ItemType {
  const byContentType = itemTypeFromContentType(page.contentType);
  if (byContentType) return byContentType;
  if (VAGUE_TYPES.has(mediaTypeOf(page.contentType))) {
    const byBytes = itemTypeFromMagicBytes(page.firstBytes);
    if (byBytes) return byBytes;
  }
  if (page.htmlHead !== null && openGraphType(page.htmlHead) === "article") return "article";
  return "link";
}
