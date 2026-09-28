import type { ItemRepository } from "../../domain/ports/item-repository";
import type { MetadataFetcher } from "../../domain/ports/metadata-fetcher";

export interface ProcessItemDeps {
  itemRepository: ItemRepository;
  metadataFetcher: MetadataFetcher;
}

export interface ProcessItemInput {
  itemId: string;
  sourceUrl: string;
}

/** Fetches metadata for a saved item and marks it ready, or failed if extraction throws. */
export async function processItem(deps: ProcessItemDeps, input: ProcessItemInput): Promise<void> {
  try {
    const metadata = await deps.metadataFetcher.fetch(input.sourceUrl);
    await deps.itemRepository.updateStatus(input.itemId, "ready", { title: metadata.title });
  } catch (error) {
    await deps.itemRepository.updateStatus(input.itemId, "failed");
    throw error;
  }
}
