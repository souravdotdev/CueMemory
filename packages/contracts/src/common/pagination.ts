import { z } from "zod";

/**
 * One page of a list, newest first. `nextCursor` is opaque to clients: pass it back
 * unchanged to get the next page; null means this is the last page.
 */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
