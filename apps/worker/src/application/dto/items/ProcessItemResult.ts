import type { ItemMetadata, ItemType } from "@/domain/entities/Item";

/**
 * Ready with an Item type, title, description and Thumbnail key (null without
 * a Thumbnail), or missing: the Item was deleted (or isn't the User's), so
 * there's nothing to do.
 */
export type ProcessItemResult =
  | { outcome: "ready"; type: ItemType; metadata: ItemMetadata; thumbnailKey: string | null }
  | { outcome: "missing" };
