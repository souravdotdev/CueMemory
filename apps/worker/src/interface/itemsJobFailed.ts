import type { Container } from "inversify";
import { ITEMS_QUEUE } from "@resonory/shared/schemas/queue";
import { itemsJobHandler, type ItemsJob } from "@/interface/itemsJobs";

/** What the `failed` handler reads from a BullMQ job. */
export interface FailedItemsJob extends ItemsJob {
  id?: string;
  /** Failed attempts so far, this one included. */
  attemptsMade: number;
  opts: { attempts?: number };
  /**
   * When BullMQ moved the job to the failed set. BullMQ sets it only when no
   * attempt is left: after the last retry, an unrecoverable error, or a job
   * that stalled more than the allowed number of times. A retried attempt has none.
   */
  finishedOn?: number;
}

/**
 * The Items worker's `failed` handler. Every failed attempt is logged with its
 * reason. Once no attempt is left, however the job failed (its last retry, an
 * unrecoverable error, or a stall), its name's final-failure step runs: a
 * Process Item job's Item becomes Failed. A payload that names no Item, or an
 * unknown job name, changes no Item. It never throws: it runs from an event listener.
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
  const final = typeof job.finishedOn === "number";
  console.error(
    `[worker] ${job.name} job ${job.id ?? "?"} failed on attempt ${job.attemptsMade} of ${attempts}` +
      `${final ? "" : "; it will be retried"}: ${error.message}`,
  );
  if (!final) return;

  try {
    await itemsJobHandler(job.name)?.onFinalFailure(container, job.data);
  } catch (markError) {
    const reason = markError instanceof Error ? markError.message : String(markError);
    console.error(`[worker] Couldn't mark job ${job.id ?? "?"}'s Item Failed: ${reason}`);
  }
}
