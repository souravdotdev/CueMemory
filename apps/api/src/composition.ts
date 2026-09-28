import { Container } from "inversify";
import { TYPES as ItemsTypes } from "@second-brain/items";
import type { ItemQueue, ItemRepository } from "@second-brain/items";
import { DrizzleItemRepository, BullMqItemQueue } from "@second-brain/items";

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
