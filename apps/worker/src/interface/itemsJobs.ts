import type { Container } from "inversify";
import { PROCESS_ITEM_JOB } from "@cue-memory/shared/schemas/queue";
import { processItem } from "@/interface/processors/processItem.processor";
import { processItemFailed } from "@/interface/processors/processItemFailed.processor";

/** What the Items worker reads from a BullMQ job to dispatch it. */
export interface ItemsJob {
  name: string;
  data: unknown;
}

/** How the Items worker handles one job name. */
export interface ItemsJobHandler {
  /** Runs one attempt of the job. */
  process(container: Container, data: unknown): Promise<void>;
  /** Runs once the job has failed and no attempt is left. */
  onFinalFailure(container: Container, data: unknown): Promise<void>;
}

/** Every job the Items queue carries, by name. */
const ITEMS_JOB_HANDLERS: ReadonlyMap<string, ItemsJobHandler> = new Map([
  [PROCESS_ITEM_JOB, { process: processItem, onFinalFailure: processItemFailed }],
]);

/** The handler for a job name, or undefined for a job the Items queue doesn't carry. */
export function itemsJobHandler(name: string): ItemsJobHandler | undefined {
  return ITEMS_JOB_HANDLERS.get(name);
}
