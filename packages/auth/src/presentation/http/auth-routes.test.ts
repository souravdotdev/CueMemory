import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { authRoutes, type AuthRequestHandler } from "./auth-routes";

// A stand-in for Better Auth: records the web Request it's given and answers
// with whatever Response the test hands it.
function fakeAuth(response = () => new Response(JSON.stringify({ ok: true }), { status: 200 })) {
  const requests: Request[] = [];
  const auth: AuthRequestHandler = {
    handler: vi.fn(async (request: Request) => {
      requests.push(request);
      return response();
    }),
  };
  return { auth, requests };
}

// Rate limits run against the in-memory store; production wires Redis.
async function buildApp(auth: AuthRequestHandler) {
  const app = Fastify();
  await app.register(rateLimit, { max: 5, timeWindow: "1 minute" });
  await app.register(authRoutes, { auth, rateLimit: { max: 2, timeWindow: "1 minute" } });
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}

describe("authRoutes", () => {
  it("hands a GET under /api/auth to Better Auth with its full URL and headers", async () => {
    const { auth, requests } = fakeAuth();
    const app = await buildApp(auth);

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

  it("hands a POST's JSON body to Better Auth", async () => {
    const { auth, requests } = fakeAuth();
    const app = await buildApp(auth);

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

  it("hands a non-JSON body to Better Auth byte for byte", async () => {
    const { auth, requests } = fakeAuth();
    const app = await buildApp(auth);

    await app.inject({
      method: "POST",
      url: "/api/auth/callback/google",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "code=abc&state=xyz",
    });

    expect(requests[0]!.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(await requests[0]!.text()).toBe("code=abc&state=xyz");
  });

  it("hands an empty JSON POST, such as a sign-out, to Better Auth", async () => {
    const { auth, requests } = fakeAuth();
    const app = await buildApp(auth);

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(200);
    expect(await requests[0]!.text()).toBe("");
  });

  it("sends back Better Auth's status, headers and body", async () => {
    const { auth } = fakeAuth(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
        }),
    );
    const app = await buildApp(auth);

    const res = await app.inject({ method: "GET", url: "/api/auth/callback/google" });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.body).toBe("");
  });

  it("sends back every cookie Better Auth sets, not just the last one", async () => {
    const { auth } = fakeAuth(() => {
      const headers = new Headers({ "content-type": "application/json" });
      headers.append("set-cookie", "better-auth.session_token=abc; HttpOnly");
      headers.append("set-cookie", "better-auth.state=; Max-Age=0");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    });
    const app = await buildApp(auth);

    const res = await app.inject({ method: "GET", url: "/api/auth/get-session" });

    expect(res.json()).toEqual({ ok: true });
    expect(res.headers["set-cookie"]).toEqual([
      "better-auth.session_token=abc; HttpOnly",
      "better-auth.state=; Max-Age=0",
    ]);
  });

  it("rate-limits auth routes more strictly than the rest of the API", async () => {
    const { auth } = fakeAuth();
    const app = await buildApp(auth);

    await app.inject({ method: "GET", url: "/api/auth/ok" });
    await app.inject({ method: "GET", url: "/api/auth/ok" });
    const limited = await app.inject({ method: "GET", url: "/api/auth/ok" });
    const elsewhere = await app.inject({ method: "GET", url: "/health" });

    expect(limited.statusCode).toBe(429);
    expect(elsewhere.statusCode).toBe(200);
  });
});
