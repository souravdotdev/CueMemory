import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import type { ErrorCode, ErrorResponse } from "@resonory/shared/schemas/common";
import { AppError, type AppErrorCode } from "@/domain/errors";

type SafeError = { code: ErrorCode; message: string };

// Every status maps to a fixed, safe message: domain messages, Fastify's own
// error messages and anything thrown with a statusCode never reach the client.
const clientErrors: Partial<Record<number, SafeError>> = {
  401: { code: "unauthorized", message: "You need to sign in to do that" },
  404: { code: "not_found", message: "That resource doesn't exist" },
  429: { code: "rate_limited", message: "Too many requests, please try again later" },
};
const otherClientError: SafeError = {
  code: "validation_failed",
  message: "The request could not be processed",
};
const serverError: SafeError = {
  code: "internal",
  message: "Something went wrong on our side",
};

// The HTTP meaning of each domain error code; 5xx codes are logged and sent as `internal`.
const statusOfCode: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  USER_PERMANENTLY_DELETED: 401,
  REPOSITORY_ERROR: 500,
};

function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  const body: ErrorResponse = { error: { code, message, details } };
  return reply.code(status).send(body);
}

/**
 * The one place errors become responses, all in the shared
 * `{ error: { code, message, details? } }` envelope:
 * - request validation failures → 400 `validation_failed` with the issues;
 * - domain errors (`AppError`) → the status their code maps to;
 * - Fastify's own 4xx (rate limit, bad content type, ...) → their status;
 * - anything else → a generic 500 `internal`, with the error only in the logs;
 * - unknown routes → 404 `not_found`.
 *
 * Register it before plugins and routes so they inherit the handlers.
 */
export function registerErrorMiddleware(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues = error.validation.map(({ instancePath, message }) => ({
        path: instancePath,
        message,
      }));
      return sendError(reply, 400, "validation_failed", "The request is invalid", issues);
    }

    const status = error instanceof AppError ? statusOfCode[error.code] : error.statusCode;

    if (status !== undefined && status >= 400 && status < 500) {
      const { code, message } = clientErrors[status] ?? otherClientError;
      return sendError(reply, status, code, message);
    }

    request.log.error(error);
    return sendError(reply, 500, serverError.code, serverError.message);
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(reply, 404, "not_found", `Route ${request.method} ${request.url} not found`),
  );
}
