import type { Item, ItemType } from "@/domain/entities/Item";

/** The Items Processing reads and finishes. The persistence adapter implements it. */
export interface IItemRepository {
  /** The User's Item with this id, or null if it doesn't exist (or isn't theirs). */
  findById(itemId: string, userId: string): Promise<Item | null>;
  /** Marks the User's Item Ready with its Item type. */
  markReady(itemId: string, userId: string, type: ItemType): Promise<void>;
  /** Marks the User's Item Failed with this Item type. */
  markFailed(itemId: string, userId: string, type: ItemType): Promise<void>;
}
