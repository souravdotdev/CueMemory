import { z } from "zod";

/**
 * DTOs for the /items HTTP boundary. These intentionally mirror
 * @second-brain/types' Item/ItemWithRelations shapes but are a separate,
 * hand-maintained Zod schema — per Clean Architecture, a controller's DTOs
 * are a boundary concern distinct from the domain entities in packages/types,
 * even where their shape currently overlaps closely. Domain entities stay
 * plain TypeScript (no validation library dependency); Zod validation lives
 * here, at the edge that actually needs to distrust its input.
 */

export const createItemBodySchema = z.object({
  url: z.string().url(),
  collectionId: z.string().uuid().optional(),
});

const itemTypeSchema = z.enum(["article", "tweet", "image", "video", "pdf", "link"]);
const itemStatusSchema = z.enum(["processing", "ready", "failed"]);

const itemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: itemTypeSchema,
  sourceUrl: z.string(),
  status: itemStatusSchema,
  title: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  author: z.string().nullable(),
  extractedText: z.string().nullable(),
  createdAt: z.string(),
});

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAiGenerated: z.boolean(),
  createdAt: z.string(),
});

const collectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export const itemWithRelationsSchema = itemSchema.extend({
  tags: z.array(tagSchema),
  collections: z.array(collectionSchema),
});

export const listItemsResponseSchema = z.array(itemWithRelationsSchema);

export const createItemResponseSchema = z.object({
  item: itemSchema,
  collectionId: z.string().uuid().nullable(),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});
