import type { IncomingHttpHeaders } from "node:http";
import type { FastifyPluginAsync } from "fastify";
import type { RateLimitOptions } from "@fastify/rate-limit";

/** The one thing these routes need from Better Auth: its web-standard request handler. */
export interface AuthRequestHandler {
  handler(request: Request): Promise<Response>;
}

export interface AuthRoutesOptions {
  auth: AuthRequestHandler;
  /** Applied to every auth route in place of the app-wide limit. */
  rateLimit: Pick<RateLimitOptions, "max" | "timeWindow">;
}

/**
 * Mounts Better Auth under `/api/auth/*` (sign-in, the OAuth callback,
 * get-session, sign-out): Fastify's request goes in as a web `Request`, and
 * Better Auth's `Response` comes back out unchanged.
 *
 * Register it before other routes, after `@fastify/rate-limit`.
 */
export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  // Better Auth parses bodies itself, so they pass through as raw bytes, whatever
  // their content type and even when empty. Scoped to this plugin's routes.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: { rateLimit: options.rateLimit },
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.host}`);
      const response = await options.auth.handler(
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

function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) webHeaders.append(name, item);
    }
  }
  return webHeaders;
}
