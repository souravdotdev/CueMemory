import { describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";
import type { User, UserRepository } from "../../domain";
import { createSignInHook, type SignInHookContext } from "./sign-in-hook";

const DAY = 24 * 60 * 60 * 1000;

// An active User as stored; each test overrides only what it's about.
const user = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  name: "Old Name",
  email: "signed-up@example.com",
  profileImg: null,
  deletedAt: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  ...overrides,
});

const usersHolding = (stored: User): UserRepository => ({
  findById: vi.fn(async () => stored),
  recordSignIn: vi.fn(async () => {}),
});

const idToken = (claims: Record<string, unknown>) =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

// Better Auth's context during the OAuth callback, holding the User's Sign-in identities.
const contextWith = (identities: { providerId: string; idToken?: string | null }[]) =>
  ({
    context: { internalAdapter: { findAccounts: vi.fn(async () => identities) } },
  }) satisfies SignInHookContext;

const googleIdentity = {
  providerId: "google",
  idToken: idToken({ name: "New Name", picture: "https://lh3.googleusercontent.com/a/new" }),
};

describe("the sign-in hook", () => {
  it("refreshes the User's Display name and avatar from their Google ID token", async () => {
    const users = usersHolding(user());

    await createSignInHook(users)({ userId: "user-1" }, contextWith([googleIdentity]));

    expect(users.recordSignIn).toHaveBeenCalledWith("user-1", {
      name: "New Name",
      profileImg: "https://lh3.googleusercontent.com/a/new",
    });
  });

  it("refuses a User deleted longer ago than the Grace period with a 'permanently deleted' error", async () => {
    const users = usersHolding(user({ deletedAt: new Date(Date.now() - 31 * DAY) }));

    const error = await createSignInHook(users)({ userId: "user-1" }, contextWith([googleIdentity]))
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).body).toMatchObject({
      code: "USER_PERMANENTLY_DELETED",
      message: expect.stringContaining("permanently deleted"),
    });
  });

  it("ends the sign-in with a coded error when there's no Google ID token to read the profile from", async () => {
    const users = usersHolding(user());

    const error = await createSignInHook(users)({ userId: "user-1" }, contextWith([]))
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).body).toMatchObject({ code: "GOOGLE_PROFILE_UNAVAILABLE" });
    expect(users.recordSignIn).not.toHaveBeenCalled();
  });
});
