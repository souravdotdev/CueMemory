// New Item types are added later by extending this list (see spec #13).
export const ITEM_TYPES = ["article", "tweet", "video", "image", "pdf", "link"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["processing", "ready", "failed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface Item {
  id: string;
  userId: string;
  sourceUrl: string;
  // Null only while the Item is Processing.
  type: ItemType | null;
  status: ItemStatus;
  title: string | null;
  description: string | null;
  // Object-storage key, never a URL; the storage adapter resolves it.
  thumbnailKey: string | null;
  extractedText: string | null;
  // Present exactly when the Item is Failed.
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
