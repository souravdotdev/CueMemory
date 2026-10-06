import type { Tag, TagLink } from "../../domain/tag";
import type { itemTags, tags } from "./schema/tags";

// Dates pass through unchanged; ISO strings are the contract mapper's job (see ADR 0001).
export function toTag(row: typeof tags.$inferSelect): Tag {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// The denormalized user_id only exists for the same-owner foreign keys, so it's dropped here.
export function toTagLink(row: typeof itemTags.$inferSelect): TagLink {
  return {
    itemId: row.itemId,
    tagId: row.tagId,
    source: row.source,
  };
}
