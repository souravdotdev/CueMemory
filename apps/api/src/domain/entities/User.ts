/** Someone signed in with Google; identified by `id`, shown by their Display name (`name`). */
export interface User {
  id: string;
  name: string;
  email: string;
  profileImg: string | null;
  // Soft-delete marker; see the users schema and Auth ADR 0001.
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
