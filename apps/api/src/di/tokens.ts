/**
 * The container's runtime names. Interfaces don't exist at runtime, so each
 * dependency is looked up by a unique Symbol; `di/container.ts` binds them.
 */
export const TOKENS = {
  /** The validated environment (`Env`). */
  Env: Symbol("Env"),
  /** The Drizzle database over the shared Postgres client. */
  Database: Symbol("Database"),
  /** Where Users are stored (`UserRepository`). */
  UserRepository: Symbol("UserRepository"),
  /** The Better Auth instance; routes use its web-standard request handler. */
  Auth: Symbol("Auth"),
  /** Finds the User behind a request's Session (`SessionResolver`). */
  SessionResolver: Symbol("SessionResolver"),
  /** The fail-fast Redis for @fastify/rate-limit's store; unbound means in-memory. */
  RateLimitRedis: Symbol("RateLimitRedis"),
} as const;
