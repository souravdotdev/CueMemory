import { inject, injectable } from "inversify";
import { toItemCardOutput, type ItemCardOutput } from "@/application/dto/items/ItemCardOutput";
import { TOKENS } from "@/di/tokens";
import type { IQueueProvider } from "@/domain/providers/IQueueProvider";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

export interface SaveItemInput {
  userId: string;
  /** The Source URL, already trimmed and checked to be http(s). */
  sourceUrl: string;
}

/**
 * Saves a pasted URL as a Processing Item for the User, then enqueues its
 * Processing. The card comes back straight away, with no Item type yet; the
 * worker decides it. If enqueueing fails the request fails, and the stored
 * Item stays Processing.
 */
@injectable()
export class SaveItemUseCase {
  constructor(
    @inject(TOKENS.ItemRepository) private readonly items: IItemRepository,
    @inject(TOKENS.QueueProvider) private readonly queue: IQueueProvider,
  ) {}

  async execute(input: SaveItemInput): Promise<ItemCardOutput> {
    const item = await this.items.create({ userId: input.userId, sourceUrl: input.sourceUrl });
    await this.queue.enqueueProcessItem({ itemId: item.id, userId: item.userId });
    // A just-saved Item has no Thumbnail key, so its card needs no Thumbnail provider.
    return toItemCardOutput(item, []);
  }
}
