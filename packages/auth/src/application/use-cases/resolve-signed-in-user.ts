import { isDeleted, type SessionResolver, type User } from "../../domain";

export interface ResolveSignedInUserDeps {
  sessions: SessionResolver;
}

export interface ResolveSignedInUserInput {
  headers: Headers;
}

/**
 * Who is calling: the User of the request's Session, or null. A deleted User's
 * old Sessions count as nobody, so they're refused everywhere (Auth ADR 0001).
 */
export async function resolveSignedInUser(
  deps: ResolveSignedInUserDeps,
  input: ResolveSignedInUserInput,
): Promise<User | null> {
  const user = await deps.sessions.resolve(input.headers);
  if (user === null || isDeleted(user)) return null;
  return user;
}
