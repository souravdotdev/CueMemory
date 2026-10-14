import { z } from "zod";

// Mirrors the domain's ITEM_TYPES / ITEM_STATUSES / TAG_SOURCES. The contract can't import
// the domain, so the API's Item card output (toItemCardOutput) asserts at compile time that the lists match.
export const ItemTypeSchema = z.enum(["article", "tweet", "video", "image", "pdf", "link"]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemStatusSchema = z.enum(["processing", "ready", "failed"]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

// Who applied a Tag to the Item.
export const TagSourceSchema = z.enum(["ai", "user"]);
export type TagSource = z.infer<typeof TagSourceSchema>;

/** A Tag as it appears on an Item card, with who applied it so the UI can mark AI suggestions. */
export const ItemCardTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: TagSourceSchema,
});
export type ItemCardTag = z.infer<typeof ItemCardTagSchema>;

/**
 * The one V1 view of an Item: serves the feed, search results and the save response.
 * Never carries internals (User id, extracted text, Thumbnail key, updated time, why an Item failed).
 */
export const ItemCardSchema = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  // Null only while the Item is Processing.
  type: ItemTypeSchema.nullable(),
  status: ItemStatusSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  // A short-lived signed link, never the storage key.
  thumbnailUrl: z.string().nullable(),
  // A friendly explanation, present only when the Item is Failed.
  failureMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  // Empty when the Item has no Tags yet.
  tags: z.array(ItemCardTagSchema),
});

export type ItemCard = z.infer<typeof ItemCardSchema>;
