import type { ItemRef } from "@/domain/entities/Item";

/**
 * Where an Item's Thumbnail is kept, inside the `thumbnails` bucket: one
 * fixed path per Item, under its User, so reprocessing overwrites it.
 */
export function thumbnailKeyOf({ userId, itemId }: ItemRef): string {
  return `${userId}/${itemId}.webp`;
}
