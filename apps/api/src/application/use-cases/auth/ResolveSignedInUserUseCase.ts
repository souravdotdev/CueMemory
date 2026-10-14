import { inject, injectable } from "inversify";
import { TOKENS } from "@/di/tokens";
import type { User } from "@/domain/entities/User";
import { UnauthorizedError } from "@/domain/errors";
import type { ISessionProvider } from "@/domain/providers/ISessionProvider";
import { isDeleted } from "@/domain/rules/signInDecision";

export interface ResolveSignedInUserInput {
  headers: Headers;
}

/**
 * Who is calling: the User of the request's Session. No valid Session, or a
 * deleted User's old Session, is refused with `UnauthorizedError`, so a deleted
 * User is refused everywhere (Auth ADR 0001).
 */
@injectable()
export class ResolveSignedInUserUseCase {
  constructor(@inject(TOKENS.SessionProvider) private readonly sessions: ISessionProvider) {}

  async execute(input: ResolveSignedInUserInput): Promise<User> {
    const user = await this.sessions.resolve(input.headers);
    if (user === null || isDeleted(user)) throw new UnauthorizedError();
    return user;
  }
}
