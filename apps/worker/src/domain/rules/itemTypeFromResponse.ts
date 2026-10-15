import type { ItemType } from "@/domain/entities/Item";
import type { FetchedPage } from "@/domain/providers/IUrlFetcher";
import { itemTypeFromContentType } from "@/domain/rules/itemTypeFromContentType";
import { itemTypeFromMagicBytes } from "@/domain/rules/itemTypeFromMagicBytes";
import { mediaTypeOf } from "@/domain/rules/mediaType";

// Content-Types that say only "some bytes": the first bytes decide instead.
const VAGUE_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/**
 * Works out an Item type from what a fetched response is, as a file: its
 * Content-Type, or its magic bytes when the Content-Type is missing or vague.
 * Null for HTML and anything else it doesn't recognise (the page's own
 * declarations decide next).
 */
export function itemTypeFromResponse(page: FetchedPage): ItemType | null {
  const byContentType = itemTypeFromContentType(page.contentType);
  if (byContentType) return byContentType;
  const vague = VAGUE_TYPES.has(mediaTypeOf(page.contentType));
  return vague ? itemTypeFromMagicBytes(page.firstBytes) : null;
}
