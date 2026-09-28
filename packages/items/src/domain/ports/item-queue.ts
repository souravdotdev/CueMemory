import type { ItemType } from "@second-brain/types";

/** Enqueued right after a paste-a-link save; a worker fetches metadata + AI tags. */
export interface ProcessItemJob {
  itemId: string;
  sourceUrl: string;
  type: ItemType;
}

/**
 * Port the background-job layer must implement. The use-case layer depends
 * only on this interface — never on BullMQ, Redis, or any queue detail.
 */
export interface ItemQueue {
  enqueueProcessing(job: ProcessItemJob): Promise<void>;
}
