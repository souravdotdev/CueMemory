import { z } from "zod";

/** The BullMQ queue Items wait on for Processing. The API produces onto it; the worker consumes it. */
export const ITEMS_QUEUE = "items";

/** The job that runs an Item's Processing. */
export const PROCESS_ITEM_JOB = "process-item";

/**
 * A Process Item job's payload: which Item, and whose. Only ids travel through
 * Redis; the worker loads the Item itself, scoped to its User.
 */
export const ProcessItemJobSchema = z.object({
  itemId: z.uuid(),
  userId: z.uuid(),
});

export type ProcessItemJob = z.infer<typeof ProcessItemJobSchema>;
