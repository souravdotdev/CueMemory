import { inject, injectable } from "inversify";
import { WORKER_TOKENS } from "@/di/tokens";
import type { ItemType } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

export interface FailItemInput {
  itemId: string;
  userId: string;
}

/** Failed with the Item type it keeps, or missing: the Item was deleted (or isn't the User's). */
export type FailItemResult = { outcome: "failed"; type: ItemType } | { outcome: "missing" };

/**
 * Gives up an Item's Processing after its last attempt: marks it Failed. An
 * Item with no Item type yet becomes a Link, so it still displays like any
 * other Item. Why it failed is the caller's to log; it isn't stored.
 */
@injectable()
export class FailItemUseCase {
  constructor(@inject(WORKER_TOKENS.ItemRepository) private readonly items: IItemRepository) {}

  async execute(input: FailItemInput): Promise<FailItemResult> {
    const item = await this.items.findById(input.itemId, input.userId);
    if (!item) return { outcome: "missing" };

    const type = item.type ?? "link";
    await this.items.markFailed(item.id, item.userId, type);
    return { outcome: "failed", type };
  }
}
