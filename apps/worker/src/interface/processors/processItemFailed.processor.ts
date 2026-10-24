import type { Container } from "inversify";
import { ProcessItemJobSchema } from "@resonory/shared/schemas/queue";
import type { FailItemUseCase } from "@/application/use-cases/items/FailItemUseCase";
import { WORKER_TOKENS } from "@/di/tokens";

/**
 * Runs after a Process Item job's last attempt failed: marks its Item Failed.
 * A payload that doesn't parse names no Item, so nothing changes.
 */
export async function processItemFailed(container: Container, data: unknown): Promise<void> {
  const payload = ProcessItemJobSchema.safeParse(data);
  if (!payload.success) return;

  const useCase = container.get<FailItemUseCase>(WORKER_TOKENS.FailItemUseCase);
  const result = await useCase.execute(payload.data);

  if (result.outcome === "failed") {
    console.log(`[worker] Item ${payload.data.itemId} is Failed as ${result.type}`);
  } else {
    console.log(`[worker] Item ${payload.data.itemId} no longer exists; nothing to mark Failed`);
  }
}
