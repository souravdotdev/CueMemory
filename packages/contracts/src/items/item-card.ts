import { z } from "zod";

// Mirrors the domain's ITEM_TYPES / ITEM_STATUSES. The contract can't import the domain,
// so packages/items' presentation layer asserts at compile time that the lists match.
export const itemTypeDtoSchema = z.enum(["article", "tweet", "video", "image", "pdf", "link"]);
export type ItemTypeDto = z.infer<typeof itemTypeDtoSchema>;

export const itemStatusDtoSchema = z.enum(["processing", "ready", "failed"]);
export type ItemStatusDto = z.infer<typeof itemStatusDtoSchema>;

/**
 * The one V1 view of an Item: serves the feed, search results and the save response.
 * Never carries internals (User id, extracted text, Thumbnail key, updated time, why an Item failed).
 */
export const itemCardDtoSchema = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  // Null only while the Item is Processing.
  type: itemTypeDtoSchema.nullable(),
  status: itemStatusDtoSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  // A short-lived signed link, never the storage key.
  thumbnailUrl: z.string().nullable(),
  // A friendly explanation, present only when the Item is Failed.
  failureMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type ItemCardDto = z.infer<typeof itemCardDtoSchema>;
