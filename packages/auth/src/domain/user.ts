export interface User {
  id: string;
  name: string;
  email: string;
  profileImg: string | null;
  // Soft-delete marker; see the users schema and ADR 0001.
  deletedAt: Date | null;
  createdAt: Date;
}
