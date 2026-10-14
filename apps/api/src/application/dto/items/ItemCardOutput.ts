import type {
  ItemCard,
  ItemStatus as SharedItemStatus,
  ItemType as SharedItemType,
  TagSource as SharedTagSource,
} from "@cue-memory/shared/schemas/items";
import type { Item, ItemStatus, ItemType } from "@/domain/entities/Item";
import type { AppliedTag, TagSource } from "@/domain/entities/Tag";
import type { IThumbnailUrlProvider } from "@/domain/providers/IThumbnailUrlProvider";

/** The Item card: the only shape of an Item the web app ever sees. */
export type ItemCardOutput = ItemCard;

// The shared schema can't import the domain, so both keep their own Item type, status and
// Tag source lists. These fail the build if either side gains or loses a value the other lacks.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const itemTypesMatch: Equals<ItemType, SharedItemType> = true;
const itemStatusesMatch: Equals<ItemStatus, SharedItemStatus> = true;
const tagSourcesMatch: Equals<TagSource, SharedTagSource> = true;
void itemTypesMatch;
void itemStatusesMatch;
void tagSourcesMatch;

// Why an Item failed isn't stored; the worker logs it. Every Failed card gets the same message.
const FAILURE_MESSAGE = "We couldn't process this link. Try again.";

/** Builds the Item card for an Item and its applied Tags, signing the Thumbnail URL. */
export async function toItemCardOutput(
  item: Item,
  tags: readonly AppliedTag[],
  thumbnails: IThumbnailUrlProvider,
): Promise<ItemCardOutput> {
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
    tags: tags.map(({ tag, source }) => ({ id: tag.id, name: tag.name, source })),
  };
}
