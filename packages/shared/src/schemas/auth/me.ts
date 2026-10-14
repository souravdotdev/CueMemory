import { z } from "zod";

/** The signed-in User, as `GET /me` returns them. Never carries the deletion time or Better Auth internals. */
export const MeResponseSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  // The email captured at sign-up.
  email: z.string(),
  // The Google profile photo; null when the User has none.
  avatarUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
