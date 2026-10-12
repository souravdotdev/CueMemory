import type { SessionResolver, User } from "../../domain";
import { toUser } from "../persistence/user-mappers";

/** The User Better Auth's get-session returns: the `users` row, with optional fields possibly missing. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Declared to Better Auth as an additional User field in createAuth.
  deletedAt?: Date | null;
};

/** The one piece of Better Auth's server API this adapter uses. */
export interface SessionApi {
  getSession(context: { headers: Headers }): Promise<{ user: SessionUser } | null>;
}

/** Resolves a request's Session through Better Auth, which checks the `sessions` table every time. */
export class BetterAuthSessionResolver implements SessionResolver {
  constructor(private readonly api: SessionApi) {}

  async resolve(headers: Headers): Promise<User | null> {
    const session = await this.api.getSession({ headers });
    if (session === null) return null;

    const { user } = session;
    return toUser({ ...user, image: user.image ?? null, deletedAt: user.deletedAt ?? null });
  }
}
