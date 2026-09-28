import { injectable } from "inversify";
import type { ItemQueue, ProcessItemJob } from "../../domain/ports/item-queue";
import { itemProcessingQueue } from "./queues";

/** Concrete adapter: implements the use-case layer's ItemQueue port with BullMQ. */
@injectable()
export class BullMqItemQueue implements ItemQueue {
  async enqueueProcessing(job: ProcessItemJob): Promise<void> {
    await itemProcessingQueue.add("process-item", job);
  }
}
