import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKER_TOKENS } from "@/di/tokens";

// ioredis connects as soon as it's constructed, so the shared Redis connection
// is a stand-in. The Postgres client connects lazily, on its first query, which
// no test here makes.
vi.mock("@cue-memory/db/redis", () => ({ redisConnection: { stub: "redis connection" } }));

// importing the db client validates DATABASE_URL, so it's stubbed before a fresh
// copy of the container is imported.
async function productionContainer() {
  vi.stubEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/cue_memory");
  vi.resetModules();
  const { createContainer } = await import("@/di/container");
  // The fresh module graph has its own token Symbols.
  const { WORKER_TOKENS: tokens } = await import("@/di/tokens");
  return { container: createContainer(), tokens };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the worker's production container", () => {
  it.each(Object.keys(WORKER_TOKENS) as (keyof typeof WORKER_TOKENS)[])(
    "resolves WORKER_TOKENS.%s",
    async (name) => {
      const { container, tokens } = await productionContainer();

      expect(container.get(tokens[name])).toBeDefined();
    },
  );
});
