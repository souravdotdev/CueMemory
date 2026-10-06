import { z } from "zod";

export const errorCodeDtoSchema = z.enum([
  "validation_failed",
  "not_found",
  "unauthorized",
  "rate_limited",
  "internal",
]);

export type ErrorCodeDto = z.infer<typeof errorCodeDtoSchema>;

/** The one envelope every API error is sent in. */
export const errorDtoSchema = z.object({
  error: z.object({
    code: errorCodeDtoSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorDto = z.infer<typeof errorDtoSchema>;
