import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Container } from "inversify";
import { z } from "zod";
import { MeResponseSchema } from "@cue-memory/shared/schemas/auth";
import { ErrorResponseSchema } from "@cue-memory/shared/schemas/common";
import { buildApp } from "@/app";
import { GetMeUseCase } from "@/application/use-cases/auth/GetMeUseCase";
import { ResolveSignedInUserUseCase } from "@/application/use-cases/auth/ResolveSignedInUserUseCase";
import type { User } from "@/domain/entities/User";
import {
  NotFoundError,
  RepositoryError,
  UnauthorizedError,
  UserPermanentlyDeletedError,
} from "@/domain/errors";
import type { ISessionProvider } from "@/domain/providers/ISessionProvider";
import { TOKENS } from "@/di/tokens";
import type { Env } from "@/env";
import { MeController } from "@/interface/controllers/MeController";
import { authMiddleware, signedInUser } from "@/interface/middleware/auth.middleware";
import type { AuthRequestHandler } from "@/interface/routes/auth.routes";

const env: Env = {
  PORT: 4000,
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  WEB_ORIGIN: "https://allowed.example.com",
};

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
const sessionsReturning = (found: User | null): ISessionProvider => ({
  resolve: vi.fn(async () => found),
});

// A test container: the real app, use cases and controllers, with fakes for
// Better Auth and the Session lookup (by default no request has a valid Session).
// No rate-limit Redis is bound, so the limits run on the in-memory store.
function testContainer(sessions: ISessionProvider = sessionsReturning(null)) {
  const container = new Container();
  container.bind(TOKENS.Env).toConstantValue(env);
  container.bind<AuthRequestHandler>(TOKENS.Auth).toConstantValue({
    handler: async () => Response.json({ ok: true }),
  });
  container.bind<ISessionProvider>(TOKENS.SessionProvider).toConstantValue(sessions);
  container.bind(TOKENS.ResolveSignedInUserUseCase).to(ResolveSignedInUserUseCase);
  container.bind(TOKENS.GetMeUseCase).to(GetMeUseCase);
  container.bind(TOKENS.MeController).to(MeController);
  return container;
}

const withSessionCookie = { cookie: "better-auth.session_token=abc" };

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

  it("sends unknown routes as 404 not_found in the error envelope", async () => {
    const app = await buildApp(testContainer());

    const res = await app.inject({ method: "GET", url: "/nope" });

    expect(res.statusCode).toBe(404);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("not_found");
  });
});

describe("GET /me", () => {
  it("is 401 unauthorized without a valid Session", async () => {
    const app = await buildApp(testContainer(sessionsReturning(null)));

    const res = await app.inject({ method: "GET", url: "/me" });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });

  it("is 401 unauthorized for a deleted User's Session", async () => {
    const deleted = user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") });
    const app = await buildApp(testContainer(sessionsReturning(deleted)));

    const res = await app.inject({ method: "GET", url: "/me", headers: withSessionCookie });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });

  it("returns the signed-in User in the me contract, without internals", async () => {
    const app = await buildApp(testContainer(sessionsReturning(user())));

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
    const app = await buildApp(testContainer(sessionsReturning(user({ profileImg: null }))));

    const res = await app.inject({ method: "GET", url: "/me", headers: withSessionCookie });

    expect(res.statusCode).toBe(200);
    expect(res.json().avatarUrl).toBeNull();
  });
});

// The real app plus a test-only protected route that echoes who it sees.
async function appWithProtectedRoute(sessions: ISessionProvider) {
  const container = testContainer(sessions);
  const app = await buildApp(container);
  app.get("/protected", { preHandler: authMiddleware(container) }, async (request) => ({
    userId: signedInUser(request).id,
  }));
  return app;
}

describe("the auth middleware", () => {
  it("refuses a request with no valid Session with 401 unauthorized", async () => {
    const app = await appWithProtectedRoute(sessionsReturning(null));

    const res = await app.inject({ method: "GET", url: "/protected" });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });

  it("refuses a deleted User's Session with 401 unauthorized", async () => {
    const deleted = user({ deletedAt: new Date("2026-05-01T00:00:00.000Z") });
    const app = await appWithProtectedRoute(sessionsReturning(deleted));

    const res = await app.inject({ method: "GET", url: "/protected", headers: withSessionCookie });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
  });

  it("lets a valid Session through, and the route sees its User", async () => {
    const app = await appWithProtectedRoute(sessionsReturning(user({ id: "user-42" })));

    const res = await app.inject({ method: "GET", url: "/protected", headers: withSessionCookie });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: "user-42" });
  });

  it("hands the request's headers to the session provider", async () => {
    const sessions = sessionsReturning(user());
    const app = await appWithProtectedRoute(sessions);

    await app.inject({ method: "GET", url: "/protected", headers: withSessionCookie });

    const headers = vi.mocked(sessions.resolve).mock.calls[0]![0];
    expect(headers.get("cookie")).toBe("better-auth.session_token=abc");
  });
});

// The real app plus test-only routes: one declaring a body and a response schema,
// and one that throws whatever the test hands it.
async function appWithTestRoutes(thrown: unknown = new Error("unused")) {
  const app = await buildApp(testContainer());
  app.post(
    "/echo",
    {
      schema: {
        body: z.object({ name: z.string().min(1) }),
        response: { 200: z.object({ name: z.string() }) },
      },
    },
    async (request) => ({ name: request.body.name, secret: "internal-only" }),
  );
  app.get("/throws", async () => {
    throw thrown;
  });
  return app;
}

describe("the API's schemas and error envelope", () => {
  it("serializes a valid request through the response schema", async () => {
    const app = await appWithTestRoutes();

    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "Ada" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ name: "Ada" });
  });

  it("strips a response field the schema doesn't declare", async () => {
    const app = await appWithTestRoutes();

    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "Ada" } });

    expect(res.body).not.toContain("secret");
    expect(res.body).not.toContain("internal-only");
  });

  it("rejects invalid input with 400 validation_failed and the issues in details", async () => {
    const app = await appWithTestRoutes();

    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "" } });

    expect(res.statusCode).toBe(400);
    const body = ErrorResponseSchema.parse(res.json());
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.message).toBe("The request is invalid");
    expect(body.error.details).toEqual([{ path: "/name", message: expect.any(String) }]);
  });

  it("sends an unmapped client error as validation_failed with a generic message, not Fastify's", async () => {
    const app = await appWithTestRoutes();

    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/x-secret-format" },
      payload: "name=Ada",
    });

    expect(res.statusCode).toBe(415);
    const body = ErrorResponseSchema.parse(res.json());
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.message).toBe("The request could not be processed");
    expect(res.body).not.toContain("x-secret-format");
  });

  it("turns an unexpected throw into a generic 500 internal without leaking internals", async () => {
    const app = await appWithTestRoutes(new Error("connect ECONNREFUSED db.internal:5432"));

    const res = await app.inject({ method: "GET", url: "/throws" });

    expect(res.statusCode).toBe(500);
    expect(ErrorResponseSchema.parse(res.json()).error).toEqual({
      code: "internal",
      message: "Something went wrong on our side",
    });
    expect(res.body).not.toContain("ECONNREFUSED");
    expect(res.body).not.toContain("db.internal");
  });

  it("sends a domain NotFoundError as 404 not_found with a safe message", async () => {
    const app = await appWithTestRoutes(new NotFoundError("Item item-7 is not in table items"));

    const res = await app.inject({ method: "GET", url: "/throws" });

    expect(res.statusCode).toBe(404);
    expect(ErrorResponseSchema.parse(res.json()).error).toEqual({
      code: "not_found",
      message: "That resource doesn't exist",
    });
  });

  it("sends a domain UnauthorizedError as 401 unauthorized with a safe message", async () => {
    const app = await appWithTestRoutes(new UnauthorizedError());

    const res = await app.inject({ method: "GET", url: "/throws" });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error).toEqual({
      code: "unauthorized",
      message: "You need to sign in to do that",
    });
  });

  it("sends a permanently deleted User as 401 unauthorized without the User id", async () => {
    const app = await appWithTestRoutes(new UserPermanentlyDeletedError("user-9"));

    const res = await app.inject({ method: "GET", url: "/throws" });

    expect(res.statusCode).toBe(401);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("unauthorized");
    expect(res.body).not.toContain("user-9");
  });

  it("sends a RepositoryError as a generic 500 internal without its cause", async () => {
    const app = await appWithTestRoutes(
      new RepositoryError("Saving the User failed", {
        cause: new Error('relation "users" does not exist'),
      }),
    );

    const res = await app.inject({ method: "GET", url: "/throws" });

    expect(res.statusCode).toBe(500);
    expect(ErrorResponseSchema.parse(res.json()).error.code).toBe("internal");
    expect(res.body).not.toContain("Saving the User");
    expect(res.body).not.toContain("users");
  });
});
