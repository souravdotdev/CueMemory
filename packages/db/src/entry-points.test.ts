import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ioredis opens a socket as soon as it's constructed; these tests are about
// which environment variables an entry point validates, not about connecting.
vi.mock("ioredis", () => ({
  default: vi.fn(function FakeRedis() {
    return {};
  }),
}));

describe("database package entry points", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("imports the Postgres client without a Redis URL", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/cue_memory");
    vi.stubEnv("REDIS_URL", undefined);

    const { pgClient } = await import("@cue-memory/db/client");

    expect(pgClient).toBeDefined();
  });

  it("imports the Redis connection without a database URL", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6380");
    vi.stubEnv("DATABASE_URL", undefined);

    const { redisConnection } = await import("@cue-memory/db/redis");

    expect(redisConnection).toBeDefined();
  });

  it("refuses to load the Postgres client without a valid database URL", async () => {
    vi.stubEnv("DATABASE_URL", "not a url");

    await expect(import("@cue-memory/db/client")).rejects.toThrow(/DATABASE_URL/);
  });

  it("refuses to load the Redis connection without a valid Redis URL", async () => {
    vi.stubEnv("REDIS_URL", undefined);

    await expect(import("@cue-memory/db/redis")).rejects.toThrow(/REDIS_URL/);
  });
});
