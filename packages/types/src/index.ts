export type ItemType = "article" | "tweet" | "image" | "video" | "pdf" | "link";

export type ItemStatus = "processing" | "ready" | "failed";

export interface Item {
  id: string;
  userId: string;
  type: ItemType;
  sourceUrl: string;
  status: ItemStatus;
  title: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  extractedText: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  itemId: string;
  triggerAt: string;
  sentAt: string | null;
}

/** Payload accepted by POST /items — the paste-a-link capture flow. */
export interface CreateItemInput {
  url: string;
  collectionId?: string;
}

export interface ItemWithRelations extends Item {
  tags: Tag[];
  collections: Collection[];
}
