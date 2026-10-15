import { and, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { items } from "@cue-memory/db/schema";
import { WORKER_TOKENS } from "@/di/tokens";
import type { Item, ItemType } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import type { Database } from "@/infrastructure/database/Database";

/** Items in the `items` table, through Drizzle, always scoped to their User. */
@injectable()
export class DrizzleItemRepository implements IItemRepository {
  constructor(@inject(WORKER_TOKENS.Database) private readonly db: Database) {}

  async findById(itemId: string, userId: string): Promise<Item | null> {
    const [row] = await this.db
      .select({
        id: items.id,
        userId: items.userId,
        sourceUrl: items.sourceUrl,
        type: items.type,
        status: items.status,
      })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async markReady(itemId: string, userId: string, type: ItemType): Promise<void> {
    await this.db
      .update(items)
      .set({ status: "ready", type, updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  }

  async markFailed(itemId: string, userId: string, type: ItemType): Promise<void> {
    await this.db
      .update(items)
      .set({ status: "failed", type, updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  }
}
