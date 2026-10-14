import { GRACE_PERIOD_DAYS } from "@/domain/rules/signInDecision";
import { AppError } from "./AppError";

/** A User deleted longer ago than the Grace period tried to sign in. */
export class UserPermanentlyDeletedError extends AppError {
  constructor(readonly userId: string) {
    super(
      `User ${userId} was deleted more than ${GRACE_PERIOD_DAYS} days ago`,
      "USER_PERMANENTLY_DELETED",
    );
  }
}
