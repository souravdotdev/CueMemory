export interface User {
  id: string;
  name: string;
  email: string;
  profileImg: string | null;
  // Soft-delete marker; see the users schema and ADR 0001.
  deletedAt: Date | null;
  createdAt: Date;
}

/**
 * What the sign-in provider says about a User right now. `name` is null when the
 * provider sends none, so an existing Display name is kept rather than blanked.
 */
export interface SignInProfile {
  name: string | null;
  profileImg: string | null;
}

/** A User who asked to leave: their Sessions are refused until a User restore or the purge (Auth ADR 0001). */
export function isDeleted(user: User): boolean {
  return user.deletedAt !== null;
}
