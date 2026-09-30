import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { ErrorCodeDto, ErrorDto } from "@cue-memory/contracts/common";

type ErrorResponse = { code: ErrorCodeDto; message: string };

// Every status maps to a fixed, safe message: Fastify's own error messages
// (and anything thrown with a statusCode) never reach the client.
const clientErrors: Partial<Record<number, ErrorResponse>> = {
  401: { code: "unauthorized", message: "You need to sign in to do that" },
  404: { code: "not_found", message: "That resource doesn't exist" },
  429: { code: "rate_limited", message: "Too many requests, please try again later" },
};
const otherClientError: ErrorResponse = {
  code: "validation_failed",
  message: "The request could not be processed",
};
const serverError: ErrorResponse = {
  code: "internal",
  message: "Something went wrong on our side",
};

function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCodeDto,
  message: string,
  details?: unknown,
) {
  const body: ErrorDto = { error: { code, message, details } };
  return reply.code(status).send(body);
}

/**
 * Wires the shared zod contracts into a Fastify app: routes validate their
 * request and serialize their response through the schemas they declare
 * (undeclared response fields are stripped), and every error leaves in the
 * common `{ error: { code, message, details? } }` envelope.
 *
 * Call it before registering plugins and routes so they inherit the handlers.
 */
export function registerContracts(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues = error.validation.map(({ instancePath, message }) => ({
        path: instancePath,
        message,
      }));
      return sendError(reply, 400, "validation_failed", "The request is invalid", issues);
    }

    const status = error.statusCode;

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

  return app.withTypeProvider<ZodTypeProvider>();
}
