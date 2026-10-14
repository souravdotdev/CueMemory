import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Container } from "inversify";
import { ErrorResponseSchema } from "@cue-memory/shared/schemas/common";
import { buildApp } from "@/app";
import { TOKENS } from "@/di/tokens";
import type { Env } from "@/env";
import type { AuthRequestHandler } from "@/interface/routes/auth.routes";

const env: Env = {
  PORT: 4000,
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  WEB_ORIGIN: "https://allowed.example.com",
};

// A stand-in for Better Auth: records the web Request it's given and answers
// with whatever Response the test hands it.
function fakeAuth(response = () => Response.json({ ok: true })) {
  const requests: Request[] = [];
  const auth: AuthRequestHandler = {
    handler: vi.fn(async (request: Request) => {
      requests.push(request);
      return response();
    }),
  };
  return { auth, requests };
}

// The real app with a fake Better Auth. No rate-limit Redis is bound, so the
// limits count in memory.
function appWith(auth: AuthRequestHandler) {
  const container = new Container();
  container.bind(TOKENS.Env).toConstantValue(env);
  container.bind<AuthRequestHandler>(TOKENS.Auth).toConstantValue(auth);
  return buildApp(container);
}

describe("the /api/auth/* routes", () => {
  it("hand a GET to Better Auth with its full URL and headers", async () => {
    const { auth, requests } = fakeAuth();
    const app = await appWith(auth);

    await app.inject({
      method: "GET",
      url: "/api/auth/callback/google?code=abc&state=xyz",
      headers: { host: "localhost:4000", cookie: "state=xyz" },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe("GET");
    expect(requests[0]!.url).toBe(
      "http://localhost:4000/api/auth/callback/google?code=abc&state=xyz",
    );
    expect(requests[0]!.headers.get("cookie")).toBe("state=xyz");
  });

  it("hand a POST's JSON body to Better Auth", async () => {
    const { auth, requests } = fakeAuth();
    const app = await appWith(auth);

    await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      payload: { provider: "google", callbackURL: "http://localhost:3000/" },
    });

    expect(requests[0]!.method).toBe("POST");
    expect(await requests[0]!.json()).toEqual({
      provider: "google",
      callbackURL: "http://localhost:3000/",
    });
  });

  it("hand a form-encoded body to Better Auth byte for byte", async () => {
    const { auth, requests } = fakeAuth();
    const app = await appWith(auth);

    await app.inject({
      method: "POST",
      url: "/api/auth/callback/google",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "code=abc&state=xyz",
    });

    expect(requests[0]!.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(await requests[0]!.text()).toBe("code=abc&state=xyz");
  });

  it("hand an empty JSON POST, such as a sign-out, to Better Auth", async () => {
    const { auth, requests } = fakeAuth();
    const app = await appWith(auth);

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(200);
    expect(await requests[0]!.text()).toBe("");
  });

  it("send back Better Auth's status, headers and body", async () => {
    const { auth } = fakeAuth(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
        }),
    );
    const app = await appWith(auth);

    const res = await app.inject({ method: "GET", url: "/api/auth/callback/google" });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.body).toBe("");
  });

  it("send back every cookie Better Auth sets, not just the last one", async () => {
    const { auth } = fakeAuth(() => {
      const headers = new Headers({ "content-type": "application/json" });
      headers.append("set-cookie", "better-auth.session_token=abc; HttpOnly");
      headers.append("set-cookie", "better-auth.state=; Max-Age=0");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    });
    const app = await appWith(auth);

    const res = await app.inject({ method: "GET", url: "/api/auth/get-session" });

    expect(res.json()).toEqual({ ok: true });
    expect(res.headers["set-cookie"]).toEqual([
      "better-auth.session_token=abc; HttpOnly",
      "better-auth.state=; Max-Age=0",
    ]);
  });

  it("limit each client to 30 requests a minute, while other routes keep 100", async () => {
    const app = await appWith(fakeAuth().auth);

    const auth = await app.inject({ method: "GET", url: "/api/auth/ok" });
    const elsewhere = await app.inject({ method: "GET", url: "/health" });

    expect(auth.statusCode).toBe(200);
    expect(auth.headers["x-ratelimit-limit"]).toBe("30");
    expect(elsewhere.headers["x-ratelimit-limit"]).toBe("100");
  });

  it("refuse the 31st request in a minute with 429 rate_limited, and other routes still answer", async () => {
    const app = await appWith(fakeAuth().auth);

    for (let i = 0; i < 30; i++) await app.inject({ method: "GET", url: "/api/auth/ok" });
    const limited = await app.inject({ method: "GET", url: "/api/auth/ok" });
    const elsewhere = await app.inject({ method: "GET", url: "/health" });

    expect(limited.statusCode).toBe(429);
    expect(ErrorResponseSchema.parse(limited.json()).error.code).toBe("rate_limited");
    expect(elsewhere.statusCode).toBe(200);
  });
});
