import type { ItemType } from "@/domain/entities/Item";
import type { FetchedFile } from "@/domain/providers/IUrlFetcher";
import { itemTypeFromContentType } from "@/domain/rules/itemTypeFromContentType";
import { itemTypeFromMagicBytes } from "@/domain/rules/itemTypeFromMagicBytes";
import { mediaTypeOf } from "@/domain/rules/mediaType";

// Content-Types that say only "some bytes": the first bytes decide instead.
const VAGUE_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/**
 * Works out an Item type from a fetched file (a 2xx answer that isn't HTML):
 * its Content-Type, or its magic bytes when the Content-Type is missing or
 * vague. Null for anything it doesn't recognise.
 */
export function itemTypeFromResponse(file: FetchedFile): ItemType | null {
  const byContentType = itemTypeFromContentType(file.contentType);
  if (byContentType) return byContentType;
  const vague = VAGUE_TYPES.has(mediaTypeOf(file.contentType));
  return vague ? itemTypeFromMagicBytes(file.firstBytes) : null;
}
