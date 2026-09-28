import type { Redis } from "ioredis";
import { redisConnection } from "@second-brain/shared-kernel/redis";

/**
 * A dedicated Redis connection for @fastify/rate-limit's store, separate
 * from the BullMQ connection (@second-brain/shared-kernel's redisConnection). BullMQ
 * requires maxRetriesPerRequest: null so its blocking commands retry
 * forever — the opposite of what rate-limit checks want. Without a fail-fast
 * connection here, a Redis outage could make every request hang waiting on
 * a rate-limit check instead of erroring out quickly.
 */
export const rateLimitRedis: Redis = redisConnection.duplicate({
  maxRetriesPerRequest: 1,
  connectTimeout: 500,
});
