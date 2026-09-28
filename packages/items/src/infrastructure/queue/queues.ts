import { Queue } from "bullmq";
import { redisConnection } from "@second-brain/shared-kernel/redis";
import type { ProcessItemJob } from "../../domain/ports/item-queue";

export const QUEUE_NAMES = {
  ITEM_PROCESSING: "item-processing",
} as const;

export const itemProcessingQueue = new Queue<ProcessItemJob>(QUEUE_NAMES.ITEM_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
});
