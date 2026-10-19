import type { ItemMetadata, ItemType } from "@/domain/entities/Item";

/** Ready with an Item type, title and description, or missing: the Item was deleted (or isn't the User's), so there's nothing to do. */
export type ProcessItemResult =
  { outcome: "ready"; type: ItemType; metadata: ItemMetadata } | { outcome: "missing" };
