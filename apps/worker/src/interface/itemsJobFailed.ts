import { UnrecoverableError } from "bullmq";
import type { Container } from "inversify";
import { ITEMS_QUEUE, PROCESS_ITEM_JOB } from "@cue-memory/shared/schemas/queue";
import type { ItemsJob } from "@/interface/itemsWorker";
import { processItemFailed } from "@/interface/processors/processItemFailed.processor";

/** What the `failed` handler reads from a BullMQ job. */
export interface FailedItemsJob extends ItemsJob {
  id?: string;
  /** Failed attempts so far, this one included. */
  attemptsMade: number;
  opts: { attempts?: number };
}

/**
 * The Items worker's `failed` handler. Every failed attempt is logged with its
 * reason. After the final attempt, a Process Item job's Item becomes Failed.
 * A job that could never succeed (unrecoverable: invalid payload, unknown name)
 * changes no Item. It never throws: it runs from an event listener.
 */
export async function onItemsJobFailed(
  container: Container,
  job: FailedItemsJob | undefined,
  error: Error,
): Promise<void> {
  if (!job) {
    console.error(`[worker] A job on the ${ITEMS_QUEUE} queue failed: ${error.message}`);
    return;
  }

  const attempts = Math.max(job.opts.attempts ?? 1, 1);
  const unrecoverable = error instanceof UnrecoverableError || error.name === "UnrecoverableError";
  const final = unrecoverable || job.attemptsMade >= attempts;
  console.error(
    `[worker] ${job.name} job ${job.id ?? "?"} failed on attempt ${job.attemptsMade} of ${attempts}` +
      `${final ? "" : "; it will be retried"}: ${error.message}`,
  );
  if (!final || unrecoverable) return;

  try {
    if (job.name === PROCESS_ITEM_JOB) await processItemFailed(container, job.data);
  } catch (markError) {
    const reason = markError instanceof Error ? markError.message : String(markError);
    console.error(`[worker] Couldn't mark job ${job.id ?? "?"}'s Item Failed: ${reason}`);
  }
}
