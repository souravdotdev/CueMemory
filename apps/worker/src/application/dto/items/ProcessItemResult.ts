import type { ItemType } from "@/domain/entities/Item";

/** Ready with an Item type, or missing: the Item was deleted (or isn't the User's), so there's nothing to do. */
export type ProcessItemResult = { outcome: "ready"; type: ItemType } | { outcome: "missing" };
