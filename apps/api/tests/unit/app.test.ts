import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Container } from "inversify";
import type { AuthRequestHandler, SessionResolver } from "@cue-memory/auth";
import { ErrorResponseSchema } from "@cue-memory/shared/schemas/common";
import { buildApp } from "@/app";
import { TOKENS } from "@/di/tokens";
import type { Env } from "@/env";

const env: Env = {
  PORT: 4000,
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  WEB_ORIGIN: "https://allowed.example.com",
};

// A test container: the real app, with fakes for Better Auth and the Session lookup.
// No rate-limit Redis is bound, so the limits run on the in-memory store.
function testContainer() {
  const container = new Container();
  container.bind(TOKENS.Env).toConstantValue(env);
  container.bind<AuthRequestHandler>(TOKENS.Auth).toConstantValue({
    handler: async () => Response.json({ ok: true }),
  });
  // No request has a valid Session.
  container.bind<SessionResolver>(TOKENS.SessionResolver).toConstantValue({
    resolve: async () => null,
  });
  return container;
}

describe("the API app", () => {
  it("answers GET /health", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("sets standard security headers from helmet", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeTruthy();
  });

  it("locks Access-Control-Allow-Origin to the web origin, never the requester's", async () => {
    const app = await buildApp(testContainer());

    // With a static string `origin` config, @fastify/cors always sets this
    // header to the *configured* value — it's the browser that then refuses
    // a mismatched-origin page read access to the response, not the server
    // omitting the header. The property worth testing is that this value
    // never reflects whatever Origin the request actually sent.
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example.com" },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
  });

  it("lets the web origin send and receive the Session cookie", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "https://allowed.example.com",
        "access-control-request-method": "POST",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("limits each client to 100 requests a minute app-wide", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.headers["x-ratelimit-limit"]).toBe("100");
  });

  it("mounts Better Auth under /api/auth/* with a stricter 30 a minute", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({ method: "GET", url: "/api/auth/ok" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers["x-ratelimit-limit"]).toBe("30");
  });

  it("refuses the 31st auth request in a minute with 429 rate_limited", async () => {
    const app = await buildApp(testContainer());

    for (let i = 0; i < 30; i++) await app.inject({ method: "GET", url: "/api/auth/ok" });
    const res = await app.inject({ method: "GET", url: "/api/auth/ok" });

    expect(res.statusCode).toBe(429);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("rate_limited");
  });

  it("serves GET /me behind the Session guard", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({ method: "GET", url: "/me" });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });
});
