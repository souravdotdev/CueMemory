import type { Redis } from "ioredis";

/**
 * What `TOKENS.RateLimitRedis` holds: the Redis @fastify/rate-limit counts in,
 * or `IN_MEMORY_RATE_LIMITS` to count in the process's memory. The binding is
 * required, so a container can't fall back to memory by forgetting it: the
 * production container binds the Redis, and tests bind the in-memory choice.
 *
 * Side-effect free, unlike `rate-limit-redis.ts`, which connects on import.
 */
export type RateLimitRedis = Redis | null;

/** Count rate limits in memory (tests only; production limits must be shared through Redis). */
export const IN_MEMORY_RATE_LIMITS: RateLimitRedis = null;
