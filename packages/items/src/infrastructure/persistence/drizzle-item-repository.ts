import { injectable } from "inversify";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgClient } from "@second-brain/shared-kernel/db";
import type { CreateItemRecord, ItemRepository } from "../../domain/ports/item-repository";
import type { Item, ItemStatus, ItemWithRelations } from "@second-brain/types";
import * as schema from "./schema";
import { items } from "./schema/items";
import { toCollection, toItem, toTag } from "./item-mappers";

const db = drizzle(pgClient, { schema });

/** Concrete adapter: implements the use-case layer's ItemRepository port with Drizzle + Postgres. */
@injectable()
export class DrizzleItemRepository implements ItemRepository {
  async create(record: CreateItemRecord): Promise<Item> {
    const [row] = await db.insert(items).values(record).returning();

    if (!row) {
      throw new Error("Failed to create item");
    }

    return toItem(row);
  }

  async findAllByUser(userId: string): Promise<ItemWithRelations[]> {
    const rows = await db.query.items.findMany({
      where: eq(items.userId, userId),
      orderBy: desc(items.createdAt),
      with: {
        itemsToTags: { with: { tag: true } },
        itemsToCollections: { with: { collection: true } },
      },
    });

    return rows.map(({ itemsToTags, itemsToCollections, ...row }) => ({
      ...toItem(row),
      tags: itemsToTags.map(({ tag }) => toTag(tag)),
      collections: itemsToCollections.map(({ collection }) => toCollection(collection)),
    }));
  }

  async updateStatus(
    itemId: string,
    status: ItemStatus,
    patch?: Partial<Pick<Item, "title">>,
  ): Promise<void> {
    await db
      .update(items)
      .set({ status, ...patch })
      .where(eq(items.id, itemId));
  }
}
