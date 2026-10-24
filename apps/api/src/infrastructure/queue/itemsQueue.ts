import { Queue } from "bullmq";
import { redisConnection } from "@resonory/db/redis";
import { ITEMS_QUEUE } from "@resonory/shared/schemas/queue";

/**
 * The BullMQ Items queue, on the shared Redis connection (BullMQ needs its
 * `maxRetriesPerRequest: null`). Built at import, like the rate-limit Redis, so
 * only the container imports it.
 */
export const itemsQueue = new Queue(ITEMS_QUEUE, { connection: redisConnection });
