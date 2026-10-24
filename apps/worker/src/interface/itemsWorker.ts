import { UnrecoverableError, Worker, type ConnectionOptions } from "bullmq";
import type { Container } from "inversify";
import { ITEMS_QUEUE } from "@resonory/shared/schemas/queue";
import { onItemsJobFailed } from "@/interface/itemsJobFailed";
import { itemsJobHandler, type ItemsJob } from "@/interface/itemsJobs";

/**
 * The Items queue's front door: dispatches a job to its processor by name. An
 * unknown name can never succeed, so it fails without a retry.
 */
export async function runItemsJob(container: Container, job: ItemsJob): Promise<void> {
  const handler = itemsJobHandler(job.name);
  if (!handler) {
    throw new UnrecoverableError(`Unknown job on the ${ITEMS_QUEUE} queue: ${job.name}`);
  }
  return handler.process(container, job.data);
}

/**
 * The BullMQ worker that consumes the Items queue, on the given Redis
 * connection. A failed attempt goes to `onItemsJobFailed`, which logs it and
 * marks the Item Failed once no attempt is left.
 */
export function createItemsWorker(container: Container, connection: ConnectionOptions): Worker {
  const worker = new Worker(ITEMS_QUEUE, (job) => runItemsJob(container, job), { connection });
  worker.on("failed", (job, error) => void onItemsJobFailed(container, job, error));
  return worker;
}
