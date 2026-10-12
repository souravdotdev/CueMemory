import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import type { UserRepository } from "../../domain";
import * as schema from "../persistence/schema";
import { createAuth, type AuthConfig } from "./create-auth";

const config: AuthConfig = {
  secret: "a-test-secret-that-is-at-least-32-chars",
  baseURL: "http://localhost:4000",
  webOrigin: "http://localhost:3000",
  google: { clientId: "google-client-id", clientSecret: "google-client-secret" },
};

// No database behind it: these tests only reach code paths that fail or
// answer before Better Auth touches a table.
// Never reached: no test here gets as far as creating a Session.
const users: UserRepository = {
  findById: async () => null,
  recordSignIn: async () => {},
};

const buildAuth = (overrides: Partial<AuthConfig> = {}) =>
  createAuth(drizzle.mock({ schema }), { ...config, ...overrides }, { users });

function post(auth: ReturnType<typeof buildAuth>, path: string, body: object) {
  return auth.handler(
    new Request(`${config.baseURL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.webOrigin },
      body: JSON.stringify({ callbackURL: `${config.webOrigin}/`, ...body }),
    }),
  );
}

describe("createAuth", () => {
  it("offers no sign-in provider other than Google", async () => {
    const res = await post(buildAuth(), "/sign-in/social", { provider: "github" });

    expect(res.status).toBe(404);
  });

  it.each(["/sign-in/social", "/link-social"])(
    "refuses a %s request that asks Google for extra scopes",
    async (path) => {
      const res = await post(buildAuth(), path, {
        provider: "google",
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      });

      expect(res.status).toBe(400);
    },
  );

  it("asks Google only for the User's identity: openid, email and profile", async () => {
    const context = await buildAuth().$context;
    const google = context.socialProviders.find((provider) => provider.id === "google")!;

    const url = await google.createAuthorizationURL({
      state: "state",
      codeVerifier: "a-code-verifier-that-is-long-enough-for-pkce-0123456789",
      redirectURI: `${config.baseURL}/api/auth/callback/google`,
    });

    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "email",
      "openid",
      "profile",
    ]);
  });

  it("keeps the Session cookie on the API's own host when no cookie domain is configured", async () => {
    const context = await buildAuth().$context;

    expect(context.authCookies.sessionToken.attributes.domain).toBeUndefined();
  });

  it("shares the Session cookie across subdomains when a cookie domain is configured", async () => {
    const context = await buildAuth({ cookieDomain: "cuememory.app" }).$context;

    expect(context.authCookies.sessionToken.attributes.domain).toBe("cuememory.app");
  });
});
