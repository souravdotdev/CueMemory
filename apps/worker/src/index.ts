// Before anything that declares a decorated class.
import "reflect-metadata";
import type { Redis } from "ioredis";
import { createContainer } from "@/di/container";
import { WORKER_TOKENS } from "@/di/tokens";

// No queue is consumed yet: the worker boots, connects to Redis and waits. The
// open connection keeps the process alive until it's told to stop. Postgres
// connects lazily, on the first query a job makes.
const container = createContainer();
const redis = container.get<Redis>(WORKER_TOKENS.RedisConnection);

await redis.ping();
console.log("[worker] connected; waiting for work");

async function shutdown(signal: NodeJS.Signals) {
  console.log(`[worker] ${signal} received; closing the Redis connection`);
  await redis.quit();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
