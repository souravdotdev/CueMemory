import { describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";
import { UserPermanentlyDeletedError } from "@/domain/errors";
import {
  createSignInHook,
  type AdmitSignIn,
  type SignInHookContext,
} from "@/infrastructure/auth/signInHook";

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

// Hand-written stand-ins for AdmitSignInUseCase.
const admitting = (): AdmitSignIn => ({ execute: vi.fn(async () => {}) });
const refusing = (error: unknown): AdmitSignIn => ({
  execute: vi.fn(async () => Promise.reject(error)),
});

describe("the sign-in hook", () => {
  it("admits the sign-in with the Display name and avatar from the User's Google ID token", async () => {
    const admitSignIn = admitting();

    await createSignInHook(admitSignIn)({ userId: "user-1" }, contextWith([googleIdentity]));

    expect(admitSignIn.execute).toHaveBeenCalledWith({
      userId: "user-1",
      profile: { name: "New Name", profileImg: "https://lh3.googleusercontent.com/a/new" },
      now: expect.any(Date),
    });
  });

  it("refuses a User deleted longer ago than the Grace period with a 'permanently deleted' error", async () => {
    const error = await createSignInHook(refusing(new UserPermanentlyDeletedError("user-1")))(
      { userId: "user-1" },
      contextWith([googleIdentity]),
    )
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).body).toMatchObject({
      code: "USER_PERMANENTLY_DELETED",
      message:
        "This account was permanently deleted more than 30 days ago, so it can't be restored.",
    });
  });

  it("lets any other failure through unchanged", async () => {
    const failure = new Error("Signing-in User user-1 doesn't exist");

    await expect(
      createSignInHook(refusing(failure))({ userId: "user-1" }, contextWith([googleIdentity])),
    ).rejects.toBe(failure);
  });

  it("ends the sign-in with a coded error when there's no Google ID token to read the profile from", async () => {
    const admitSignIn = admitting();

    const error = await createSignInHook(admitSignIn)({ userId: "user-1" }, contextWith([]))
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).body).toMatchObject({ code: "GOOGLE_PROFILE_UNAVAILABLE" });
    expect(admitSignIn.execute).not.toHaveBeenCalled();
  });
});
