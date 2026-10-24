import { and, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { items } from "@resonory/db/schema";
import { WORKER_TOKENS } from "@/di/tokens";
import type { Item, ItemRef, ItemStatus, ItemType, ReadyItem } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import type { Database } from "@/infrastructure/database/Database";

/** The `items` columns ending Processing sets: a Failed Item keeps no title, description or Thumbnail key. */
type FinishedFields = Pick<typeof items.$inferInsert, "title" | "description" | "thumbnailKey"> & {
  status: ItemStatus;
  type: ItemType;
};

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

  async markReady(ref: ItemRef, { type, metadata, thumbnailKey }: ReadyItem): Promise<void> {
    await this.finish(ref, { status: "ready", type, ...metadata, thumbnailKey });
  }

  async markFailed(ref: ItemRef, type: ItemType): Promise<void> {
    await this.finish(ref, { status: "failed", type });
  }

  /** Ends the Item's Processing with this status and Item type and, when Ready, the rest it learned. */
  private async finish(ref: ItemRef, fields: FinishedFields): Promise<void> {
    await this.db
      .update(items)
      .set({ ...fields, updatedAt: new Date() })
      .where(ownedBy(ref));
  }
}

/** The one Item with this id, and only if it's this User's. */
function ownedBy({ itemId, userId }: ItemRef) {
  return and(eq(items.id, itemId), eq(items.userId, userId));
}
