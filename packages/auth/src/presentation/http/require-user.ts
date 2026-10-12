import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { resolveSignedInUser, type ResolveSignedInUserDeps } from "../../application";
import type { User } from "../../domain";
import { toWebHeaders } from "./web-headers";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireUser`; read it through `signedInUser(request)`. */
    user?: User;
  }
}

/**
 * The guard every protected route uses, as its `preHandler`: a request without a
 * valid Session, or from a deleted User, gets 401 in the `unauthorized` envelope.
 * Otherwise the route reads the domain User with `signedInUser(request)`.
 */
export function requireUser(deps: ResolveSignedInUserDeps): preHandlerAsyncHookHandler {
  return async (request) => {
    const user = await resolveSignedInUser(deps, { headers: toWebHeaders(request.headers) });
    // The shared error handler turns a 401 into the `unauthorized` envelope.
    if (user === null) throw Object.assign(new Error("No valid Session"), { statusCode: 401 });
    request.user = user;
  };
}

/** The User `requireUser` attached. Calling it on a route without the guard is a bug. */
export function signedInUser(request: FastifyRequest): User {
  if (request.user === undefined) {
    throw new Error(
      `${request.method} ${request.routeOptions.url} reads the User without requireUser`,
    );
  }
  return request.user;
}
