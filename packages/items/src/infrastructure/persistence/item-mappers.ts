import type { Item } from "../../domain/item";
import { items } from "./schema/items";

// Every field passes through unchanged, dates included; ISO strings are the
// contract mapper's job (see ADR 0001).
export function toItem(row: typeof items.$inferSelect): Item {
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
