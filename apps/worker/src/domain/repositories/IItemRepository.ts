import type { Item, ItemMetadata, ItemRef, ItemType } from "@/domain/entities/Item";

/** The Items Processing reads and finishes. The persistence adapter implements it. */
export interface IItemRepository {
  /** The User's Item, or null if it doesn't exist (or isn't theirs). */
  findById(ref: ItemRef): Promise<Item | null>;
  /**
   * Marks the User's Item Ready with its Item type, title, description and
   * Thumbnail key (null without a Thumbnail), all in one update.
   */
  markReady(
    ref: ItemRef,
    type: ItemType,
    metadata: ItemMetadata,
    thumbnailKey: string | null,
  ): Promise<void>;
  /** Marks the User's Item Failed with this Item type. */
  markFailed(ref: ItemRef, type: ItemType): Promise<void>;
}
