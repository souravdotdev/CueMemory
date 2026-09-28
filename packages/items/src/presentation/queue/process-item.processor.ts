import type { Job } from "bullmq";
import type { ProcessItemJob } from "../../domain/ports/item-queue";
import { processItem as processItemUseCase } from "../../application/use-cases/process-item";
import type { ProcessItemDeps } from "../../application/use-cases/process-item";

/** Delivery-mechanism adapter: unwraps a BullMQ job and calls the use case. */
export function createProcessItemHandler(deps: ProcessItemDeps) {
  return async function processItem(job: Job<ProcessItemJob>) {
    const { itemId, sourceUrl } = job.data;

    await processItemUseCase(deps, { itemId, sourceUrl });

    return { itemId };
  };
}
