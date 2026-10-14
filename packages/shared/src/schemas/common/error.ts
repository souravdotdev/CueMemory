import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "validation_failed",
  "not_found",
  "unauthorized",
  "rate_limited",
  "internal",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** The one envelope every API error is sent in. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
