import type { FastifyPluginAsync } from "fastify";
import type { Container } from "inversify";
import { TOKENS } from "@/di/tokens";
import { toWebHeaders } from "@/interface/http/toWebHeaders";

/** The one thing these routes need from Better Auth: its web-standard request handler. */
export interface AuthRequestHandler {
  handler(request: Request): Promise<Response>;
}

export interface AuthRoutesOptions {
  container: Container;
}

/**
 * Mounts Better Auth under `/api/auth/*` (sign-in, the OAuth callback,
 * get-session, sign-out): Fastify's request goes in as a web `Request`, and
 * Better Auth's `Response` comes back out unchanged.
 *
 * Register it before other routes, after `@fastify/rate-limit`: these routes
 * replace the app-wide limit with a stricter 30 a minute.
 */
export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, { container }) => {
  const auth = container.get<AuthRequestHandler>(TOKENS.Auth);

  // Better Auth parses bodies itself, so they pass through as raw bytes, whatever
  // their content type and even when empty. Scoped to this plugin's routes.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.host}`);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: toWebHeaders(request.headers),
          body:
            request.body instanceof Buffer && request.body.length > 0 ? request.body : undefined,
        }),
      );

      reply.status(response.status);
      response.headers.forEach((value, name) => {
        if (name !== "set-cookie") reply.header(name, value);
      });
      // Headers joins repeated set-cookie values into one string; send each cookie on its own.
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);

      return response.body === null ? reply.send() : reply.send(await response.text());
    },
  });
};
