// The same Item types and statuses as the API's Items domain and the database
// enums; tests/unit/domain/schema-agreement.test.ts keeps them in step.
export const ITEM_TYPES = [
  "article",
  "post",
  "video",
  "image",
  "audio",
  "pdf",
  "code",
  "file",
  "link",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["processing", "ready", "failed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Which Item, and whose: every Item the worker reads or changes is scoped to its User. */
export interface ItemRef {
  itemId: string;
  userId: string;
}

/** What Processing needs to know about an Item. */
export interface Item {
  id: string;
  userId: string;
  sourceUrl: string;
  // Null only while the Item is Processing.
  type: ItemType | null;
  status: ItemStatus;
}

/** What the page says it is called and is about; written to the Item when it becomes Ready. */
export interface ItemMetadata {
  title: string | null;
  description: string | null;
}

/** No title and no description: the page couldn't be read, or said nothing. */
export const NO_METADATA: ItemMetadata = { title: null, description: null };
