import { APIError } from "better-auth/api";
import { googleProfileFromIdToken, type GoogleProfile } from "./google-profile";

/** The part of Better Auth's endpoint context the hook reads: the User's Sign-in identities. */
export interface SignInHookContext {
  context: {
    internalAdapter: {
      findAccounts(userId: string): Promise<{ providerId: string; idToken?: string | null }[]>;
    };
  };
}

/**
 * The sign-in rules (the API's `AdmitSignInUseCase`): refuse, restore, refresh the
 * profile. Rejects with an error whose `code` is `USER_PERMANENTLY_DELETED` to refuse.
 */
export type AdmitSignIn = (input: {
  userId: string;
  profile: GoogleProfile;
  now: Date;
}) => Promise<void>;

export interface SignInHookDeps {
  admitSignIn: AdmitSignIn;
  /** The Grace period (Auth ADR 0001), named in the refusal's message. */
  gracePeriodDays: number;
}

const isPermanentlyDeleted = (error: unknown) =>
  error instanceof Error &&
  (error as Error & { code?: unknown }).code === "USER_PERMANENTLY_DELETED";

/**
 * Better Auth's `session.create.before` hook: runs the sign-in rules just before a
 * Session is created, with the profile from the Google ID token Better Auth has
 * just stored on the User's Sign-in identity. A refusal becomes a coded APIError,
 * which ends the OAuth flow with `?error=USER_PERMANENTLY_DELETED` and its message
 * instead of a silent failure.
 */
export function createSignInHook({ admitSignIn, gracePeriodDays }: SignInHookDeps) {
  return async (session: { userId: string }, ctx: SignInHookContext | null): Promise<void> => {
    const identities = (await ctx?.context.internalAdapter.findAccounts(session.userId)) ?? [];
    const idToken = identities.find((identity) => identity.providerId === "google")?.idToken;
    // A coded APIError, like the refusal, so the OAuth flow ends at the error URL, not in a 500.
    if (!idToken) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        code: "GOOGLE_PROFILE_UNAVAILABLE",
        message: "We couldn't read your Google profile. Please try signing in again.",
      });
    }

    try {
      await admitSignIn({
        userId: session.userId,
        profile: googleProfileFromIdToken(idToken),
        now: new Date(),
      });
    } catch (error) {
      if (!isPermanentlyDeleted(error)) throw error;
      throw new APIError("FORBIDDEN", {
        code: "USER_PERMANENTLY_DELETED",
        message: `This account was permanently deleted more than ${gracePeriodDays} days ago, so it can't be restored.`,
      });
    }
  };
}
