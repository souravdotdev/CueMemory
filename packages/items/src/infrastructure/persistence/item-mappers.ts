import type { Tag } from "@cue-memory/types";
import { tags } from "./schema/items";

// Postgres `timestamp` columns come back from Drizzle as native `Date`
// objects; the domain entities in @cue-memory/types declare `createdAt` as
// `string`. Translating between the two is exactly the repository's job.
export function toTag(row: typeof tags.$inferSelect): Tag {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
