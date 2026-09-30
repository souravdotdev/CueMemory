export interface User {
  id: string;
  // Display name, mirrored from the Google profile on every sign-in.
  name: string;
  email: string;
  profileImg: string | null;
  // Set on Account deletion; null means the User is active.
  deletedAt: string | null;
  createdAt: string;
}
