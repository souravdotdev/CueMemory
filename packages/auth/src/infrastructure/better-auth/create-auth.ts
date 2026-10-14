import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { AuthDatabase } from "../persistence/auth-database";
import { accounts, sessions, users, verifications } from "@cue-memory/db/schema";
import { createSignInHook, type SignInHookDeps } from "./sign-in-hook";

export type { AuthDatabase } from "../persistence/auth-database";

// The endpoints that start a Google authorization, where a caller could otherwise
// append its own `scopes` to the ones configured below.
const AUTHORIZATION_PATHS = new Set(["/sign-in/social", "/link-social"]);

export interface AuthConfig {
  /** Signs Sessions and encrypts OAuth tokens; at least 32 characters. */
  secret: string;
  /** The API's public URL, which serves `/api/auth/*`. */
  baseURL: string;
  /** The web app's origin, the only one trusted to start a sign-in. */
  webOrigin: string;
  google: { clientId: string; clientSecret: string };
  /** The parent domain shared by web and API in production; unset locally. */
  cookieDomain?: string;
}

/** What the sign-in hook runs: the API's sign-in rules, resolved from its container. */
export type AuthDeps = SignInHookDeps;

/**
 * Builds the Better Auth instance: Google sign-in only, over the Auth tables.
 * Every Better Auth detail (model names, the avatar column, id generation,
 * cookies, the sign-in hook) stays in here; the rest of the code sees the domain User.
 */
export function createAuth(db: AuthDatabase, config: AuthConfig, deps: AuthDeps) {
  return betterAuth({
    appName: "CueMemory",
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [config.webOrigin],
    database: drizzleAdapter(db, {
      provider: "pg",
      // Better Auth's model names mapped to our plural tables. Its `image` field
      // is the `users` table's `image` key, stored in the `profile_img` column.
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    user: {
      additionalFields: {
        // The soft-delete marker (Auth ADR 0001), read with every Session so a deleted
        // User's Sessions can be refused. Never set through Better Auth's API.
        deletedAt: { type: "date", required: false, input: false },
      },
    },
    socialProviders: {
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        // Identity only: never Gmail, Drive or Calendar.
        disableDefaultScope: true,
        scope: ["openid", "email", "profile"],
        // Not `overrideUserInfoOnSignIn`: it would also overwrite the email (spec #12).
        // The sign-in hook below refreshes only the Display name and avatar.
      },
    },
    hooks: {
      // Better Auth adds any `scopes` in the request body to the configured ones,
      // so without this a caller could ask Google for Gmail or Drive access.
      before: createAuthMiddleware(async (ctx) => {
        if (AUTHORIZATION_PATHS.has(ctx.path) && ctx.body?.scopes !== undefined) {
          throw new APIError("BAD_REQUEST", { message: "Only identity scopes can be requested" });
        }
      }),
    },
    databaseHooks: {
      // The sign-in rules: refuse, restore, and refresh the profile (Auth ADR 0001).
      session: { create: { before: createSignInHook(deps) } },
    },
    account: {
      // Sign-in identities' Google tokens are encrypted at rest.
      encryptOAuthTokens: true,
      // Better Auth's default, pinned: each sign-in stores Google's fresh ID token on
      // the Sign-in identity before the Session is created, and the sign-in hook reads
      // the profile from it. Turning this off would refresh from a stale token.
      updateAccountOnSignIn: true,
    },
    session: {
      // Default 7-day lifetime. No cookie cache: every request checks the
      // `sessions` table, so a revoked Session stops working immediately (Auth ADR 0001).
      cookieCache: { enabled: false },
    },
    advanced: {
      // With Postgres, "uuid" leaves the id to the column's gen_random_uuid() default.
      database: { generateId: "uuid" },
      // Shares the Session cookie between app.<domain> and api.<domain> (ADR 0003).
      crossSubDomainCookies: config.cookieDomain
        ? { enabled: true, domain: config.cookieDomain }
        : undefined,
    },
  });
}
