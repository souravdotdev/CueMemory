import type { ItemWithRelations } from "@cue-memory/types";
import type { ItemRepository } from "../../domain/ports/item-repository";

export interface ListItemsDeps {
  itemRepository: ItemRepository;
}

export interface ListItemsInput {
  userId: string;
}

export function listItems(
  deps: ListItemsDeps,
  input: ListItemsInput,
): Promise<ItemWithRelations[]> {
  return deps.itemRepository.findAllByUser(input.userId);
}
