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
