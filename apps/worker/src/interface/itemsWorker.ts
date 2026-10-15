import { UnrecoverableError, Worker, type ConnectionOptions } from "bullmq";
import type { Container } from "inversify";
import { ITEMS_QUEUE, PROCESS_ITEM_JOB } from "@cue-memory/shared/schemas/queue";
import { onItemsJobFailed } from "@/interface/itemsJobFailed";
import { processItem } from "@/interface/processors/processItem.processor";

/** What the job switch reads from a BullMQ job. */
export interface ItemsJob {
  name: string;
  data: unknown;
}

/**
 * The Items queue's front door: dispatches a job to its processor by name. An
 * unknown name can never succeed, so it fails without a retry.
 */
export async function runItemsJob(container: Container, job: ItemsJob): Promise<void> {
  switch (job.name) {
    case PROCESS_ITEM_JOB:
      return processItem(container, job.data);
    default:
      throw new UnrecoverableError(`Unknown job on the ${ITEMS_QUEUE} queue: ${job.name}`);
  }
}

/**
 * The BullMQ worker that consumes the Items queue, on the given Redis
 * connection. A failed attempt goes to `onItemsJobFailed`, which logs it and
 * marks the Item Failed after the last one.
 */
export function createItemsWorker(container: Container, connection: ConnectionOptions): Worker {
  const worker = new Worker(ITEMS_QUEUE, (job) => runItemsJob(container, job), { connection });
  worker.on("failed", (job, error) => void onItemsJobFailed(container, job, error));
  return worker;
}
