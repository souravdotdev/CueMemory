import type { ProcessItemJob } from "@cue-memory/shared/schemas/queue";

/** Hands background work to the worker. The queue adapter implements it. */
export interface IQueueProvider {
  /** Enqueues a Process Item job for the worker to run the Item's Processing. */
  enqueueProcessItem(job: ProcessItemJob): Promise<void>;
}
