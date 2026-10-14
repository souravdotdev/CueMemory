import type { User } from "@/domain/entities/User";

/**
 * What a sign-in may change on a User. The email is deliberately absent: it's
 * captured once at sign-up and never overwritten (spec #12).
 */
export type UserSignInChanges = Partial<Pick<User, "name" | "profileImg" | "deletedAt">>;

/** Reads Users and records sign-ins on them. The persistence adapter implements it. */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  recordSignIn(id: string, changes: UserSignInChanges): Promise<void>;
}
