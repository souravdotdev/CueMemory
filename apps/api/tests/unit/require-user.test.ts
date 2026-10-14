import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Container } from "inversify";
import {
  requireUser,
  signedInUser,
  type AuthRequestHandler,
  type SessionResolver,
  type User,
} from "@cue-memory/auth";
import { MeResponseSchema } from "@cue-memory/shared/schemas/auth";
import { ErrorResponseSchema } from "@cue-memory/shared/schemas/common";
import { buildApp } from "@/app";
import { TOKENS } from "@/di/tokens";
import type { Env } from "@/env";

// An active User with a Google avatar; each test overrides only what it's about.
const user = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  name: "Sourav Sanjay",
  email: "sourav@example.com",
  profileImg: "https://lh3.googleusercontent.com/a/avatar",
  deletedAt: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  ...overrides,
});

// A hand-written fake: the request's Session belongs to `found`, or there's none.
const sessionsReturning = (found: User | null): SessionResolver => ({
  resolve: vi.fn(async () => found),
});

const env: Env = {
  PORT: 4000,
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  WEB_ORIGIN: "https://allowed.example.com",
};

// The real app (with its GET /me) from a test container whose Session lookup is
// `sessions`, plus a dummy protected route that echoes who it sees.
async function buildTestApp(sessions: SessionResolver) {
  const container = new Container();
  container.bind(TOKENS.Env).toConstantValue(env);
  container.bind<AuthRequestHandler>(TOKENS.Auth).toConstantValue({
    handler: async () => Response.json({ ok: true }),
  });
  container.bind<SessionResolver>(TOKENS.SessionResolver).toConstantValue(sessions);

  const app = await buildApp(container);
  app.get("/protected", { preHandler: requireUser({ sessions }) }, async (request) => ({
    userId: signedInUser(request).id,
  }));
  return app;
}

const withSessionCookie = { cookie: "better-auth.session_token=abc" };

describe("requireUser", () => {
  it("refuses a request with no valid Session with 401 unauthorized", async () => {
    const app = await buildTestApp(sessionsReturning(null));

    const res = await app.inject({ method: "GET", url: "/protected" });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });

  it("refuses a deleted User's Session with 401 unauthorized", async () => {
    const deleted = user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") });
    const app = await buildTestApp(sessionsReturning(deleted));

    const res = await app.inject({ method: "GET", url: "/protected", headers: withSessionCookie });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });

  it("lets a valid Session through, and the route sees its User", async () => {
    const app = await buildTestApp(sessionsReturning(user({ id: "user-42" })));

    const res = await app.inject({ method: "GET", url: "/protected", headers: withSessionCookie });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: "user-42" });
  });

  it("hands the request's headers to the session resolver", async () => {
    const sessions = sessionsReturning(user());
    const app = await buildTestApp(sessions);

    await app.inject({ method: "GET", url: "/protected", headers: withSessionCookie });

    const headers = vi.mocked(sessions.resolve).mock.calls[0]![0];
    expect(headers.get("cookie")).toBe("better-auth.session_token=abc");
  });
});

describe("GET /me", () => {
  it("returns the signed-in User in the me contract, without internals", async () => {
    const app = await buildTestApp(sessionsReturning(user()));

    const res = await app.inject({ method: "GET", url: "/me", headers: withSessionCookie });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "user-1",
      displayName: "Sourav Sanjay",
      email: "sourav@example.com",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    expect(MeResponseSchema.safeParse(res.json()).success).toBe(true);
  });

  it("returns a null avatar for a User without a Google photo", async () => {
    const app = await buildTestApp(sessionsReturning(user({ profileImg: null })));

    const res = await app.inject({ method: "GET", url: "/me", headers: withSessionCookie });

    expect(res.json().avatarUrl).toBeNull();
  });

  it("is 401 without a valid Session", async () => {
    const app = await buildTestApp(sessionsReturning(null));

    const res = await app.inject({ method: "GET", url: "/me" });

    expect(res.statusCode).toBe(401);
  });
});
