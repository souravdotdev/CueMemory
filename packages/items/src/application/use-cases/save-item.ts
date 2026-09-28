import type { Item } from "@second-brain/types";
import type { ItemRepository } from "../../domain/ports/item-repository";
import type { ItemQueue } from "../../domain/ports/item-queue";
import { detectItemType } from "../../domain/detect-item-type";

export interface SaveItemDeps {
  itemRepository: ItemRepository;
  itemQueue: ItemQueue;
}

export interface SaveItemInput {
  userId: string;
  url: string;
}

/** The paste-a-link save flow: persist the item as processing, then hand it off for background enrichment. */
export async function saveItem(deps: SaveItemDeps, input: SaveItemInput): Promise<Item> {
  const type = detectItemType(input.url);

  const item = await deps.itemRepository.create({
    userId: input.userId,
    sourceUrl: input.url,
    type,
    status: "processing",
  });

  await deps.itemQueue.enqueueProcessing({
    itemId: item.id,
    sourceUrl: item.sourceUrl,
    type: item.type,
  });

  return item;
}
