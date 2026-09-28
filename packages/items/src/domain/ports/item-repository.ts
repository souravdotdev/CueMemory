import type { Item, ItemStatus, ItemType, ItemWithRelations } from "@second-brain/types";

export interface CreateItemRecord {
  userId: string;
  sourceUrl: string;
  type: ItemType;
  status: ItemStatus;
}

/**
 * Port the persistence layer must implement. The use-case layer depends only
 * on this interface — never on Drizzle, SQL, or any storage detail.
 */
export interface ItemRepository {
  create(record: CreateItemRecord): Promise<Item>;
  findAllByUser(userId: string): Promise<ItemWithRelations[]>;
  updateStatus(
    itemId: string,
    status: ItemStatus,
    patch?: Partial<Pick<Item, "title">>,
  ): Promise<void>;
}
