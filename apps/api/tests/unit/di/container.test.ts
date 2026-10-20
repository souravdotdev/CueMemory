import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOKENS } from "@/di/tokens";

// ioredis connects as soon as it's constructed, so the rate-limit Redis and the
// BullMQ Items queue (on the shared Redis connection) are stand-ins. The Postgres
// client connects lazily, on its first query, which no test here makes.
vi.mock("@/rate-limit-redis", () => ({ rateLimitRedis: { stub: "rate-limit redis" } }));
vi.mock("@/infrastructure/queue/itemsQueue", () => ({ itemsQueue: { stub: "items queue" } }));

// A complete, valid environment for the API and the database package.
const validEnv = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5433/cue_memory",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

// env.ts and the db client validate process.env at import time, so the
// environment is stubbed before a fresh copy of the container is imported.
async function productionContainer(overrides: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({ ...validEnv, ...overrides })) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();
  const { createContainer } = await import("@/di/container");
  // The fresh module graph has its own token Symbols.
  const { TOKENS: tokens } = await import("@/di/tokens");
  return { container: createContainer(), tokens };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the production container", () => {
  it.each(Object.keys(TOKENS) as (keyof typeof TOKENS)[])("resolves TOKENS.%s", async (name) => {
    const { container, tokens } = await productionContainer();

    expect(container.get(tokens[name])).toBeDefined();
  });

  it("signs Thumbnail links with Supabase Storage when it's configured", async () => {
    const { container, tokens } = await productionContainer();
    const { SupabaseThumbnailUrlProvider } =
      await import("@/infrastructure/storage/SupabaseThumbnailUrlProvider");

    expect(container.get(tokens.ThumbnailUrlProvider)).toBeInstanceOf(SupabaseThumbnailUrlProvider);
  });

  // Item cards then carry no Thumbnail (toItemCardOutput with no provider).
  it("binds no Thumbnail provider when Supabase Storage isn't configured", async () => {
    const { container, tokens } = await productionContainer({
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });

    expect(container.isBound(tokens.ThumbnailUrlProvider)).toBe(false);
    expect(container.isBound(tokens.ThumbnailStorage)).toBe(false);
  });
});
