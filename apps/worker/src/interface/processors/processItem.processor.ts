import { UnrecoverableError } from "bullmq";
import type { Container } from "inversify";
import { z } from "zod";
import { ProcessItemJobSchema } from "@resonory/shared/schemas/queue";
import type { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import { WORKER_TOKENS } from "@/di/tokens";

/**
 * Runs a Process Item job: checks its payload, then runs the Item's Processing.
 * A malformed payload can never succeed, so it fails without a retry; any error
 * from the Processing itself propagates, so BullMQ retries the job.
 */
export async function processItem(container: Container, data: unknown): Promise<void> {
  const payload = ProcessItemJobSchema.safeParse(data);
  if (!payload.success) {
    throw new UnrecoverableError(
      `Invalid Process Item payload:\n${z.prettifyError(payload.error)}`,
    );
  }

  const useCase = container.get<ProcessItemUseCase>(WORKER_TOKENS.ProcessItemUseCase);
  const result = await useCase.execute(payload.data);

  if (result.outcome === "ready") {
    const titled = result.metadata.title === null ? "without a title" : "with a title";
    const pictured = result.thumbnailKey === null ? "no Thumbnail" : "a Thumbnail";
    console.log(
      `[worker] Item ${payload.data.itemId} is Ready as ${result.type}, ${titled}, with ${pictured}`,
    );
  } else {
    console.log(`[worker] Item ${payload.data.itemId} no longer exists; nothing to process`);
  }
}
