import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

// Tests the middleware *behavior*, not the specific Redis-backed store —
// rate-limit runs against its default in-memory store here since no `redis`
// option is passed; production wires a dedicated Redis store separately
// (see src/rate-limit-redis.ts).
async function buildApp() {
  const app = Fastify();
  await app.register(cors, { origin: "https://allowed.example.com", credentials: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 2, timeWindow: "1 minute" });
  app.get("/ping", async () => ({ ok: true }));
  return app;
}

describe("security middleware", () => {
  it("sets standard security headers from helmet", async () => {
    const app = await buildApp();

    const res = await app.inject({ method: "GET", url: "/ping" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeTruthy();
  });

  it("locks Access-Control-Allow-Origin to the configured origin, never the requester's", async () => {
    const app = await buildApp();

    // With a static string `origin` config, @fastify/cors always sets this
    // header to the *configured* value — it's the browser that then refuses
    // a mismatched-origin page read access to the response, not the server
    // omitting the header. The property worth testing is that this value
    // never reflects whatever Origin the request actually sent — that
    // reflect-anything behavior is exactly what `origin: true` did before
    // this change, and is what made CORS effectively disabled.
    const res = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "https://evil.example.com" },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
  });

  it("lets the web origin send and receive the Session cookie", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "OPTIONS",
      url: "/ping",
      headers: {
        origin: "https://allowed.example.com",
        "access-control-request-method": "POST",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rate-limits after the configured max requests", async () => {
    const app = await buildApp();

    await app.inject({ method: "GET", url: "/ping" });
    await app.inject({ method: "GET", url: "/ping" });
    const res = await app.inject({ method: "GET", url: "/ping" });

    expect(res.statusCode).toBe(429);
  });
});
