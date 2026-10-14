import { z } from "zod";
import { paginated } from "../common";
import { itemCardDtoSchema } from "./item-card";

export const DEFAULT_LIST_LIMIT = 30;
export const MAX_LIST_LIMIT = 100;

/** One listing serves the feed, keyword search and tag filtering. */
export const listItemsQueryDtoSchema = z.object({
  q: z.string().optional(),
  tagId: z.uuid().optional(),
  // Opaque: whatever the previous page's nextCursor was.
  cursor: z.string().optional(),
  // Query-string values arrive as text, so coerce before bounding.
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

export type ListItemsQueryDto = z.infer<typeof listItemsQueryDtoSchema>;

export const listItemsResponseDtoSchema = paginated(itemCardDtoSchema);

export type ListItemsResponseDto = z.infer<typeof listItemsResponseDtoSchema>;
