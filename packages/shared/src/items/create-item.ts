import { z } from "zod";
import { itemCardDtoSchema } from "./item-card";

export const MAX_URL_LENGTH = 2048;

/** The link a User pastes to save an Item. Shared by the web save form and the API. */
export const createItemRequestDtoSchema = z.object({
  url: z
    .string()
    .trim()
    .max(MAX_URL_LENGTH, `Links can be at most ${MAX_URL_LENGTH} characters`)
    .pipe(z.url({ protocol: /^https?$/, error: "Enter a valid http(s) link" })),
});

export type CreateItemRequestDto = z.infer<typeof createItemRequestDtoSchema>;

/** A saved Item comes back as its card (201), still Processing. */
export const createItemResponseDtoSchema = itemCardDtoSchema;

export type CreateItemResponseDto = z.infer<typeof createItemResponseDtoSchema>;
