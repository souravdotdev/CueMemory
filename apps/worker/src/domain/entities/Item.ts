// The same Item types and statuses as the API's Items domain and the database
// enums; tests/unit/domain/schema-agreement.test.ts keeps them in step.
export const ITEM_TYPES = ["article", "tweet", "video", "image", "pdf", "link"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["processing", "ready", "failed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** What Processing needs to know about an Item. */
export interface Item {
  id: string;
  userId: string;
  sourceUrl: string;
  // Null only while the Item is Processing.
  type: ItemType | null;
  status: ItemStatus;
}
