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
  vi.stubEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/resonory");
  vi.resetModules();
  const { createContainer } = await import("@/di/container");
  // The fresh module graph has its own token Symbols.
  const { WORKER_TOKENS: tokens } = await import("@/di/tokens");
  return { container: createContainer(), tokens };
}

// The Thumbnail store is bound only with Supabase Storage configured.
function stubSupabaseStorage() {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the worker's production container", () => {
  it.each(Object.keys(WORKER_TOKENS) as (keyof typeof WORKER_TOKENS)[])(
    "resolves WORKER_TOKENS.%s",
    async (name) => {
      stubSupabaseStorage();
      const { container, tokens } = await productionContainer();

      expect(container.get(tokens[name])).toBeDefined();
    },
  );

  it("keeps Thumbnails in Supabase Storage when it is configured", async () => {
    stubSupabaseStorage();
    const { container, tokens } = await productionContainer();
    const { SupabaseThumbnailStore } =
      await import("@/infrastructure/storage/SupabaseThumbnailStore");

    expect(container.get(tokens.ThumbnailStore)).toBeInstanceOf(SupabaseThumbnailStore);
  });

  it.each([
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
  ])("starts without Thumbnails when %s is missing", async (missing, set) => {
    vi.stubEnv(missing, "");
    vi.stubEnv(set, set === "SUPABASE_URL" ? "https://project.supabase.co" : "service-role-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, tokens } = await productionContainer();

    // ProcessItemUseCase then gets no store, and downloads no image.
    expect(container.isBound(tokens.ThumbnailStore)).toBe(false);
    expect(container.get(tokens.ProcessItemUseCase)).toBeDefined();
  });

  // As in the API: a URL that is set must be an http(s) one, even without the key.
  it.each([
    ["project.supabase.co", "service-role-key"],
    ["ftp://project.supabase.co", "service-role-key"],
    ["ftp://project.supabase.co", ""],
  ])("refuses to start when SUPABASE_URL is %s", async (url, key) => {
    vi.stubEnv("SUPABASE_URL", url);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);

    await expect(productionContainer()).rejects.toThrow("SUPABASE_URL");
  });
});
