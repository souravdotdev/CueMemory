import { inject, injectable } from "inversify";
import type { FailItemResult } from "@/application/dto/items/FailItemResult";
import { WORKER_TOKENS } from "@/di/tokens";
import type { ItemRef } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

/**
 * Gives up an Item's Processing after its last attempt: marks it Failed. An
 * Item with no Item type yet becomes a Link, so it still displays like any
 * other Item. Why it failed is the caller's to log; it isn't stored.
 */
@injectable()
export class FailItemUseCase {
  constructor(@inject(WORKER_TOKENS.ItemRepository) private readonly items: IItemRepository) {}

  async execute(ref: ItemRef): Promise<FailItemResult> {
    const item = await this.items.findById(ref);
    if (!item) return { outcome: "missing" };

    const type = item.type ?? "link";
    await this.items.markFailed(ref, type);
    return { outcome: "failed", type };
  }
}
