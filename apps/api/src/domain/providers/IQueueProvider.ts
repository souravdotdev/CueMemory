/** Which Item to process, and whose. */
export interface ProcessItemRequest {
  itemId: string;
  userId: string;
}

/** Hands background work to the worker. The queue adapter implements it. */
export interface IQueueProvider {
  /** Enqueues a Process Item job for the worker to run the Item's Processing. */
  enqueueProcessItem(request: ProcessItemRequest): Promise<void>;
}
