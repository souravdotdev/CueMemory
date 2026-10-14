import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import type { Container } from "inversify";
import type { ResolveSignedInUserUseCase } from "@/application/use-cases/auth/ResolveSignedInUserUseCase";
import { TOKENS } from "@/di/tokens";
import type { User } from "@/domain/entities/User";
import { toWebHeaders } from "@/interface/http/toWebHeaders";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `authMiddleware`; read it through `signedInUser(request)`. */
    user?: User;
  }
}

/**
 * The guard every protected route uses, as its `preHandler`: it runs
 * `ResolveSignedInUserUseCase`, whose `UnauthorizedError` (no valid Session, or a
 * deleted User) the error middleware sends as 401 `unauthorized`. Otherwise the
 * route reads the domain User with `signedInUser(request)`. Identity always
 * comes from here, never from the request body.
 */
export function authMiddleware(container: Container): preHandlerAsyncHookHandler {
  return async (request) => {
    const resolveSignedInUser = container.get<ResolveSignedInUserUseCase>(
      TOKENS.ResolveSignedInUserUseCase,
    );
    request.user = await resolveSignedInUser.execute({ headers: toWebHeaders(request.headers) });
  };
}

/** The User `authMiddleware` attached. Calling it on a route without the guard is a bug. */
export function signedInUser(request: FastifyRequest): User {
  if (request.user === undefined) {
    throw new Error(
      `${request.method} ${request.routeOptions.url} reads the User without authMiddleware`,
    );
  }
  return request.user;
}
