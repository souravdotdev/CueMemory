import type { Item } from "../../domain/item";
import { items } from "./schema/items";

// Every field passes through unchanged, dates included; ISO strings are the
// contract mapper's job (see ADR 0001). search_vector is a search detail, not part of the Item.
export function toItem(row: Omit<typeof items.$inferSelect, "searchVector">): Item {
  return {
    id: row.id,
    userId: row.userId,
    sourceUrl: row.sourceUrl,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description,
    thumbnailKey: row.thumbnailKey,
    extractedText: row.extractedText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
