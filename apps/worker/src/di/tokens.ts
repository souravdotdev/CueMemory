/**
 * The worker container's runtime names, separate from the API's `TOKENS`.
 * Interfaces don't exist at runtime, so each dependency is looked up by a
 * unique Symbol; `di/container.ts` binds them.
 */
export const WORKER_TOKENS = {
  /** The Drizzle database over the shared Postgres client. */
  Database: Symbol("Database"),
  /** The shared Redis connection (`maxRetriesPerRequest: null`, as BullMQ needs) jobs arrive on. */
  RedisConnection: Symbol("RedisConnection"),
} as const;
