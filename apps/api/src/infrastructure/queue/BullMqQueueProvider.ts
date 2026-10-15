import type { JobsOptions } from "bullmq";
import { inject, injectable } from "inversify";
import {
  PROCESS_ITEM_JOB,
  ProcessItemJobSchema,
  type ProcessItemJob,
} from "@cue-memory/shared/schemas/queue";
import { TOKENS } from "@/di/tokens";
import type { IQueueProvider } from "@/domain/providers/IQueueProvider";

/**
 * The part of a BullMQ `Queue` this provider uses. The container binds the
 * production `itemsQueue` to it, which checks the real queue fits.
 */
export interface ItemsQueue {
  add(name: string, data: ProcessItemJob, opts: JobsOptions): Promise<unknown>;
}

// A failing Processing is retried twice more, 5 s then 10 s later. Finished jobs are
// trimmed so Redis doesn't keep job history forever (docs/queue.md).
const PROCESS_ITEM_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

/** Enqueues background work as BullMQ jobs on the Items queue. */
@injectable()
export class BullMqQueueProvider implements IQueueProvider {
  constructor(@inject(TOKENS.ItemsQueue) private readonly queue: ItemsQueue) {}

  async enqueueProcessItem(job: ProcessItemJob): Promise<void> {
    // Parsed here too, so a payload the worker would refuse never reaches Redis.
    const payload = ProcessItemJobSchema.parse(job);
    await this.queue.add(PROCESS_ITEM_JOB, payload, PROCESS_ITEM_OPTIONS);
  }
}
