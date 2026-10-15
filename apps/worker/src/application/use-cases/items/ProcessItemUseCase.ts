import { inject, injectable } from "inversify";
import type { ProcessItemResult } from "@/application/dto/items/ProcessItemResult";
import { WORKER_TOKENS } from "@/di/tokens";
import type { ItemRef } from "@/domain/entities/Item";
import type { IUrlFetcher } from "@/domain/providers/IUrlFetcher";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";
import { itemTypeFromResponse } from "@/domain/rules/itemTypeFromResponse";
import { itemTypeFromUrl } from "@/domain/rules/itemTypeFromUrl";

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

  async execute(ref: ItemRef): Promise<ProcessItemResult> {
    const item = await this.items.findById(ref);
    if (!item) return { outcome: "missing" };

    const type =
      itemTypeFromUrl(item.sourceUrl) ??
      itemTypeFromResponse(await this.fetcher.fetchPage(item.sourceUrl));
    await this.items.markReady(ref, type);
    return { outcome: "ready", type };
  }
}
