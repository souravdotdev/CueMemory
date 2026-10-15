import type { ItemType } from "@/domain/entities/Item";
import type { FetchedPage } from "@/domain/providers/IUrlFetcher";
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

/**
 * Works out an Item type from a fetched page: a PDF or an image by its
 * Content-Type, an Article when an HTML page's head declares `og:type`
 * article, and a Link otherwise.
 */
export function itemTypeFromResponse(page: FetchedPage): ItemType {
  const mediaType = mediaTypeOf(page.contentType);
  if (mediaType === "application/pdf") return "pdf";
  if (mediaType.startsWith("image/")) return "image";
  if (page.htmlHead !== null && openGraphType(page.htmlHead) === "article") return "article";
  return "link";
}
