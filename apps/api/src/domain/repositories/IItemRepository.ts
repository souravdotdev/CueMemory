import type { Item } from "@/domain/entities/Item";

/** What saving an Item needs: whose it is and the Source URL exactly as pasted (trimmed). */
export interface NewItem {
  userId: string;
  sourceUrl: string;
}

/** Stores Items. The persistence adapter implements it. */
export interface IItemRepository {
  /**
   * Stores a new Processing Item with no Item type. Source URLs aren't unique:
   * saving the same one twice creates two Items.
   */
  create(newItem: NewItem): Promise<Item>;
}
