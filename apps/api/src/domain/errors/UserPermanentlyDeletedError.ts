import { AppError } from "./AppError";

/** How long after User deletion the User can still be restored by signing in again (Auth ADR 0001). */
const GRACE_PERIOD_DAYS = 30;

/** A User deleted longer ago than the Grace period tried to sign in. */
export class UserPermanentlyDeletedError extends AppError {
  constructor(readonly userId: string) {
    super(
      `User ${userId} was deleted more than ${GRACE_PERIOD_DAYS} days ago`,
      "USER_PERMANENTLY_DELETED",
    );
  }
}
