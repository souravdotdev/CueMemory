import type { Collection, Item, Tag } from "@second-brain/types";
import { collections, items, tags } from "./schema/items";

// Postgres `timestamp` columns come back from Drizzle as native `Date`
// objects; the domain entities in @second-brain/types declare `createdAt` as
// `string`. Translating between the two is exactly the repository's job.
export function toItem(row: typeof items.$inferSelect): Item {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export function toTag(row: typeof tags.$inferSelect): Tag {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export function toCollection(row: typeof collections.$inferSelect): Collection {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
