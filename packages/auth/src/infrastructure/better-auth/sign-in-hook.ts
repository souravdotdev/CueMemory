import { APIError } from "better-auth/api";
import { admitSignIn } from "../../application";
import { GRACE_PERIOD_DAYS, UserPermanentlyDeletedError, type UserRepository } from "../../domain";
import { googleProfileFromIdToken } from "./google-profile";

/** The part of Better Auth's endpoint context the hook reads: the User's Sign-in identities. */
export interface SignInHookContext {
  context: {
    internalAdapter: {
      findAccounts(userId: string): Promise<{ providerId: string; idToken?: string | null }[]>;
    };
  };
}

/**
 * Better Auth's `session.create.before` hook: runs `admitSignIn` just before a
 * Session is created, with the profile from the Google ID token Better Auth has
 * just stored on the User's Sign-in identity. A refusal becomes a coded APIError,
 * which ends the OAuth flow with `?error=USER_PERMANENTLY_DELETED` and its message
 * instead of a silent failure.
 */
export function createSignInHook(users: UserRepository) {
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
      await admitSignIn(
        { users },
        { userId: session.userId, profile: googleProfileFromIdToken(idToken), now: new Date() },
      );
    } catch (error) {
      if (!(error instanceof UserPermanentlyDeletedError)) throw error;
      throw new APIError("FORBIDDEN", {
        code: "USER_PERMANENTLY_DELETED",
        message: `This account was permanently deleted more than ${GRACE_PERIOD_DAYS} days ago, so it can't be restored.`,
      });
    }
  };
}
