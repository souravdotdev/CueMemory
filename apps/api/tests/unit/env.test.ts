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
});
