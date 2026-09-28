import { Container } from "inversify";
import { TYPES as ItemsTypes } from "@cue-memory/items";
import type { ItemQueue, ItemRepository } from "@cue-memory/items";
import { DrizzleItemRepository, BullMqItemQueue } from "@cue-memory/items";

/**
 * Composition root: the one place concrete infrastructure adapters get
 * bound and resolved for the use-case layer. Nothing below this file knows
 * inversify, Drizzle, or BullMQ exist.
 */
const container = new Container();

container
  .bind<ItemRepository>(ItemsTypes.ItemRepository)
  .to(DrizzleItemRepository)
  .inSingletonScope();
container.bind<ItemQueue>(ItemsTypes.ItemQueue).to(BullMqItemQueue).inSingletonScope();

export const dependencies = {
  itemRepository: container.get<ItemRepository>(ItemsTypes.ItemRepository),
  itemQueue: container.get<ItemQueue>(ItemsTypes.ItemQueue),
};

export type Dependencies = typeof dependencies;
