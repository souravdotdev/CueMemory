import "reflect-metadata";
import { Worker } from "bullmq";
import { QUEUE_NAMES, createProcessItemHandler } from "@second-brain/items";
import { redisConnection } from "@second-brain/shared-kernel/redis";
import { dependencies } from "./composition";

const worker = new Worker(QUEUE_NAMES.ITEM_PROCESSING, createProcessItemHandler(dependencies), {
  connection: redisConnection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`[worker] processed item ${job.data.itemId}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] failed item ${job?.data.itemId}:`, err.message);
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
