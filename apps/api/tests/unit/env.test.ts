import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A complete, valid auth configuration; each test breaks only what it's about.
const validEnv = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  WEB_ORIGIN: "http://localhost:3000",
};

// env.ts validates process.env once, at import time, so each test stubs the
// environment and then imports a fresh copy of the module.
function loadEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({ ...validEnv, ...overrides })) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();
  return import("@/env").then((module) => module.env);
}

beforeEach(() => {
  vi.stubEnv("AUTH_COOKIE_DOMAIN", undefined);
  vi.stubEnv("SUPABASE_URL", undefined);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api env", () => {
  it("accepts a complete auth configuration, with no cookie domain by default", async () => {
    const env = await loadEnv();

    expect(env).toMatchObject(validEnv);
    expect(env.AUTH_COOKIE_DOMAIN).toBeUndefined();
  });

  it("accepts an optional cookie domain", async () => {
    const env = await loadEnv({ AUTH_COOKIE_DOMAIN: "cuememory.app" });

    expect(env.AUTH_COOKIE_DOMAIN).toBe("cuememory.app");
  });

  it.each(Object.keys(validEnv))("refuses to load when %s is missing", async (name) => {
    await expect(loadEnv({ [name]: undefined })).rejects.toThrow(name);
  });

  it("refuses an auth secret shorter than 32 characters", async () => {
    await expect(loadEnv({ BETTER_AUTH_SECRET: "a".repeat(31) })).rejects.toThrow(
      "BETTER_AUTH_SECRET",
    );
  });

  it("refuses an auth base URL that isn't a URL", async () => {
    await expect(loadEnv({ BETTER_AUTH_URL: "localhost:4000" })).rejects.toThrow("BETTER_AUTH_URL");
  });

  it.each(["not a url", "http://localhost:3000/", "http://localhost:3000/app"])(
    "refuses a web origin that isn't a bare origin (%s)",
    async (origin) => {
      await expect(loadEnv({ WEB_ORIGIN: origin })).rejects.toThrow("WEB_ORIGIN");
    },
  );

  it("leaves Thumbnail storage unconfigured by default", async () => {
    const env = await loadEnv();

    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it("accepts a Supabase Storage configuration", async () => {
    const env = await loadEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    expect(env.SUPABASE_URL).toBe("https://project.supabase.co");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
  });

  it("refuses a Supabase URL that isn't a URL", async () => {
    await expect(
      loadEnv({ SUPABASE_URL: "project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" }),
    ).rejects.toThrow("SUPABASE_URL");
  });

  // Half a configuration would silently leave every Thumbnail off.
  it.each([
    ["SUPABASE_URL", { SUPABASE_SERVICE_ROLE_KEY: "service-role-key" }],
    ["SUPABASE_SERVICE_ROLE_KEY", { SUPABASE_URL: "https://project.supabase.co" }],
  ])("refuses a Supabase Storage configuration missing %s", async (name, overrides) => {
    await expect(loadEnv(overrides)).rejects.toThrow(name);
  });
});
