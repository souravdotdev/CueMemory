import type { ItemCardDto, ItemStatusDto, ItemTypeDto } from "@cue-memory/contracts/items";
import type { Item, ItemStatus, ItemType, ThumbnailUrlResolver } from "../../domain";

// The contract can't import the domain, so both keep their own Item type and status
// lists. These fail the build if either side gains or loses a value the other lacks.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const itemTypesMatch: Equals<ItemType, ItemTypeDto> = true;
const itemStatusesMatch: Equals<ItemStatus, ItemStatusDto> = true;
void itemTypesMatch;
void itemStatusesMatch;

// Why an Item failed isn't stored; the worker logs it. Every Failed card gets the same message.
const FAILURE_MESSAGE = "We couldn't process this link. Try again.";

/** Builds the Item card: the only shape of an Item the web app ever sees. */
export async function toItemCardDto(
  item: Item,
  thumbnails: ThumbnailUrlResolver,
): Promise<ItemCardDto> {
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    type: item.type,
    status: item.status,
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnailKey ? await thumbnails.resolve(item.thumbnailKey) : null,
    failureMessage: item.status === "failed" ? FAILURE_MESSAGE : null,
    createdAt: item.createdAt.toISOString(),
  };
}
