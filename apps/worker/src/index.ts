// Before anything that declares a decorated class.
import "reflect-metadata";
import type { Redis } from "ioredis";
import { ITEMS_QUEUE } from "@resonory/shared/schemas/queue";
import { createContainer } from "@/di/container";
import { WORKER_TOKENS } from "@/di/tokens";
import { createItemsWorker } from "@/interface/itemsWorker";

// The worker consumes the Items queue until it's told to stop. Postgres
// connects lazily, on the first query a job makes.
const container = createContainer();
const redis = container.get<Redis>(WORKER_TOKENS.RedisConnection);

await redis.ping();
const itemsWorker = createItemsWorker(container, redis);
console.log(`[worker] connected; consuming the ${ITEMS_QUEUE} queue`);

async function shutdown(signal: NodeJS.Signals) {
  console.log(`[worker] ${signal} received; finishing the current job and closing`);
  await itemsWorker.close();
  await redis.quit();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
