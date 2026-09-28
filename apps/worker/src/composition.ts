import { Container } from "inversify";
import { TYPES as ItemsTypes } from "@second-brain/items";
import type { ItemRepository, MetadataFetcher } from "@second-brain/items";
import { DrizzleItemRepository, StubMetadataFetcher } from "@second-brain/items";

/**
 * Composition root: the one place concrete infrastructure adapters get
 * bound and resolved for the use-case layer. Nothing below this file knows
 * inversify or Drizzle exist.
 */
const container = new Container();

container
  .bind<ItemRepository>(ItemsTypes.ItemRepository)
  .to(DrizzleItemRepository)
  .inSingletonScope();
container
  .bind<MetadataFetcher>(ItemsTypes.MetadataFetcher)
  .to(StubMetadataFetcher)
  .inSingletonScope();

export const dependencies = {
  itemRepository: container.get<ItemRepository>(ItemsTypes.ItemRepository),
  metadataFetcher: container.get<MetadataFetcher>(ItemsTypes.MetadataFetcher),
};

export type Dependencies = typeof dependencies;
