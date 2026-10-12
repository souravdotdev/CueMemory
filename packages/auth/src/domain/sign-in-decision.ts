/** How long after User deletion the User can still be restored by signing in again (Auth ADR 0001). */
export const GRACE_PERIOD_DAYS = 30;

const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * What happens when someone signs in as a User:
 * - `allow`: an active User signs in as usual;
 * - `restore`: a deleted User within the Grace period gets their User back (User restore);
 * - `refuse`: a User deleted longer ago is gone, even before the purge removes the row.
 */
export type SignInDecision = "allow" | "restore" | "refuse";

/** Decides a sign-in from the User's deletion time. Deleted exactly 30 days ago is still restorable. */
export function decideSignIn(deletedAt: Date | null, now: Date): SignInDecision {
  if (deletedAt === null) return "allow";
  return now.getTime() - deletedAt.getTime() <= GRACE_PERIOD_MS ? "restore" : "refuse";
}

/** Thrown when a User deleted longer ago than the Grace period tries to sign in. */
export class UserPermanentlyDeletedError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} was deleted more than ${GRACE_PERIOD_DAYS} days ago`);
    this.name = "UserPermanentlyDeletedError";
  }
}
