import { inject, injectable } from "inversify";
import { TOKENS } from "@/di/tokens";
import type { User } from "@/domain/entities/User";
import type { ISessionProvider } from "@/domain/providers/ISessionProvider";

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
@injectable()
export class BetterAuthSessionProvider implements ISessionProvider {
  constructor(@inject(TOKENS.Auth) private readonly auth: { api: SessionApi }) {}

  async resolve(headers: Headers): Promise<User | null> {
    const session = await this.auth.api.getSession({ headers });
    if (session === null) return null;

    // `emailVerified`/`updatedAt` are Better Auth internals with no use case, and
    // `image` (the column Better Auth's adapter expects) is the domain's `profileImg`.
    const { user } = session;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profileImg: user.image ?? null,
      deletedAt: user.deletedAt ?? null,
      createdAt: user.createdAt,
    };
  }
}
