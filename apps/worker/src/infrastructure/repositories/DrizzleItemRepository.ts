import { and, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { items } from "@cue-memory/db/schema";
import { WORKER_TOKENS } from "@/di/tokens";
import type { Item, ItemMetadata, ItemRef, ItemType } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import type { Database } from "@/infrastructure/database/Database";

/** Items in the `items` table, through Drizzle, always scoped to their User. */
@injectable()
export class DrizzleItemRepository implements IItemRepository {
  constructor(@inject(WORKER_TOKENS.Database) private readonly db: Database) {}

  async findById(ref: ItemRef): Promise<Item | null> {
    const [row] = await this.db
      .select({
        id: items.id,
        userId: items.userId,
        sourceUrl: items.sourceUrl,
        type: items.type,
        status: items.status,
      })
      .from(items)
      .where(ownedBy(ref))
      .limit(1);
    return row ?? null;
  }

  async markReady(
    ref: ItemRef,
    type: ItemType,
    { title, description }: ItemMetadata,
  ): Promise<void> {
    await this.db
      .update(items)
      .set({ status: "ready", type, title, description, updatedAt: new Date() })
      .where(ownedBy(ref));
  }

  async markFailed(ref: ItemRef, type: ItemType): Promise<void> {
    await this.db
      .update(items)
      .set({ status: "failed", type, updatedAt: new Date() })
      .where(ownedBy(ref));
  }
}

/** The one Item with this id, and only if it's this User's. */
function ownedBy({ itemId, userId }: ItemRef) {
  return and(eq(items.id, itemId), eq(items.userId, userId));
}
