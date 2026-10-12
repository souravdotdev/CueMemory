import {
  decideSignIn,
  UserPermanentlyDeletedError,
  type SignInProfile,
  type UserRepository,
  type UserSignInChanges,
} from "../../domain";

export interface AdmitSignInDeps {
  users: UserRepository;
}

export interface AdmitSignInInput {
  userId: string;
  profile: SignInProfile;
  now: Date;
}

/**
 * Applies the sign-in rules before a Session is created (Auth ADR 0001, spec #12):
 * refuses a User deleted longer ago than the Grace period, restores one deleted
 * within it, and refreshes the Display name and avatar on every allowed sign-in.
 * The email is never touched.
 */
export async function admitSignIn(deps: AdmitSignInDeps, input: AdmitSignInInput): Promise<void> {
  const user = await deps.users.findById(input.userId);
  if (user === null) throw new Error(`Signing-in User ${input.userId} doesn't exist`);

  const decision = decideSignIn(user.deletedAt, input.now);
  if (decision === "refuse") throw new UserPermanentlyDeletedError(user.id);

  const changes: UserSignInChanges = { profileImg: input.profile.profileImg };
  if (input.profile.name !== null) changes.name = input.profile.name;
  if (decision === "restore") changes.deletedAt = null;

  await deps.users.recordSignIn(user.id, changes);
}
