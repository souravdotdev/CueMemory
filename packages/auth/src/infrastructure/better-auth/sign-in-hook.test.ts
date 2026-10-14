import { describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";
import { createSignInHook, type AdmitSignIn, type SignInHookContext } from "./sign-in-hook";

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

// What the API's admit-sign-in use case rejects with when the Grace period is over.
const permanentlyDeleted = Object.assign(
  new Error("User user-1 was deleted more than 30 days ago"),
  {
    code: "USER_PERMANENTLY_DELETED",
  },
);

const admitting = (): AdmitSignIn => vi.fn(async () => {});
const refusing = (error: unknown): AdmitSignIn => vi.fn(async () => Promise.reject(error));

const hook = (admitSignIn: AdmitSignIn) => createSignInHook({ admitSignIn, gracePeriodDays: 30 });

describe("the sign-in hook", () => {
  it("admits the sign-in with the Display name and avatar from the User's Google ID token", async () => {
    const admitSignIn = admitting();

    await hook(admitSignIn)({ userId: "user-1" }, contextWith([googleIdentity]));

    expect(admitSignIn).toHaveBeenCalledWith({
      userId: "user-1",
      profile: { name: "New Name", profileImg: "https://lh3.googleusercontent.com/a/new" },
      now: expect.any(Date),
    });
  });

  it("refuses a User deleted longer ago than the Grace period with a 'permanently deleted' error", async () => {
    const error = await hook(refusing(permanentlyDeleted))(
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
      hook(refusing(failure))({ userId: "user-1" }, contextWith([googleIdentity])),
    ).rejects.toBe(failure);
  });

  it("ends the sign-in with a coded error when there's no Google ID token to read the profile from", async () => {
    const admitSignIn = admitting();

    const error = await hook(admitSignIn)({ userId: "user-1" }, contextWith([]))
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).body).toMatchObject({ code: "GOOGLE_PROFILE_UNAVAILABLE" });
    expect(admitSignIn).not.toHaveBeenCalled();
  });
});
