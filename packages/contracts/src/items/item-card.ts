import { z } from "zod";

// Mirrors the domain's ITEM_TYPES / ITEM_STATUSES / TAG_SOURCES. The contract can't import
// the domain, so packages/items' presentation layer asserts at compile time that the lists match.
export const itemTypeDtoSchema = z.enum(["article", "tweet", "video", "image", "pdf", "link"]);
export type ItemTypeDto = z.infer<typeof itemTypeDtoSchema>;

export const itemStatusDtoSchema = z.enum(["processing", "ready", "failed"]);
export type ItemStatusDto = z.infer<typeof itemStatusDtoSchema>;

// Who applied a Tag to the Item.
export const tagSourceDtoSchema = z.enum(["ai", "user"]);
export type TagSourceDto = z.infer<typeof tagSourceDtoSchema>;

/** A Tag as it appears on an Item card, with who applied it so the UI can mark AI suggestions. */
export const itemCardTagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: tagSourceDtoSchema,
});
export type ItemCardTagDto = z.infer<typeof itemCardTagDtoSchema>;

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
  // Empty when the Item has no Tags yet.
  tags: z.array(itemCardTagDtoSchema),
});

export type ItemCardDto = z.infer<typeof itemCardDtoSchema>;
