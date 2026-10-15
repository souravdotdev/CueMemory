import { inject, injectable } from "inversify";
import { WORKER_TOKENS } from "@/di/tokens";
import type { ItemType } from "@/domain/entities/Item";
import type { IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import { itemTypeFromResponse } from "@/domain/rules/itemTypeFromResponse";
import { itemTypeFromUrl } from "@/domain/rules/itemTypeFromUrl";

export interface ProcessItemInput {
  itemId: string;
  userId: string;
}

/** Ready with an Item type, or missing: the Item was deleted (or isn't the User's), so there's nothing to do. */
export type ProcessItemResult = { outcome: "ready"; type: ItemType } | { outcome: "missing" };

/**
 * Runs an Item's Processing: works out its Item type from the Source URL's
 * shape, or, when no rule recognises it, from one guarded fetch of the page,
 * and marks it Ready with that type. Any error (a refused or failed fetch
 * included) propagates, so the job is retried.
 */
@injectable()
export class ProcessItemUseCase {
  constructor(
    @inject(WORKER_TOKENS.ItemRepository) private readonly items: IItemRepository,
    @inject(WORKER_TOKENS.UrlFetcher) private readonly fetcher: IUrlFetcher,
  ) {}

  async execute(input: ProcessItemInput): Promise<ProcessItemResult> {
    const item = await this.items.findById(input.itemId, input.userId);
    if (!item) return { outcome: "missing" };

    const type =
      itemTypeFromUrl(item.sourceUrl) ??
      itemTypeFromResponse(await this.fetcher.fetchPage(item.sourceUrl));
    await this.items.markReady(item.id, item.userId, type);
    return { outcome: "ready", type };
  }
}
