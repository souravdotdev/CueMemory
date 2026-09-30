import type { Item } from "../../domain/item";
import { items } from "./schema/items";

// Nullable fields pass through unchanged.
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
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
