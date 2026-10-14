/** The signed-in User as `GET /me` sends them: no deletion time, ISO created time. */
export interface MeOutput {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}
