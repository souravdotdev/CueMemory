import { z } from "zod";
import { ItemCardSchema } from "./item-card";

export const MAX_URL_LENGTH = 2048;

/** The link a User pastes to save an Item. Shared by the web save form and the API. */
export const CreateItemSchema = z.object({
  url: z
    .string()
    .trim()
    .max(MAX_URL_LENGTH, `Links can be at most ${MAX_URL_LENGTH} characters`)
    .pipe(z.url({ protocol: /^https?$/, error: "Enter a valid http(s) link" })),
});

export type CreateItemInput = z.infer<typeof CreateItemSchema>;

/** A saved Item comes back as its card (201), still Processing. */
export const CreateItemResponseSchema = ItemCardSchema;

export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;
