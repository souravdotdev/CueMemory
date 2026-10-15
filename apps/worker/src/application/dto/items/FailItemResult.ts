import type { ItemType } from "@/domain/entities/Item";

/** Failed with the Item type it keeps, or missing: the Item was deleted (or isn't the User's). */
export type FailItemResult = { outcome: "failed"; type: ItemType } | { outcome: "missing" };
