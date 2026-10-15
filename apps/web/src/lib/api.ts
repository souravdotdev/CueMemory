import { ErrorResponseSchema } from "@cue-memory/shared/schemas/common";
import {
  CreateItemResponseSchema,
  ListItemsResponseSchema,
  type CreateItemResponse,
  type ListItemsResponse,
} from "@cue-memory/shared/schemas/items";
import { env } from "../env";

const API_URL = env.NEXT_PUBLIC_API_URL;

// Every non-2xx response should carry the common error envelope; surface its message.
async function toApiError(res: Response, fallback: string): Promise<Error> {
  const body: unknown = await res.json().catch(() => null);
  const parsed = ErrorResponseSchema.safeParse(body);
  return new Error(parsed.success ? parsed.data.error.message : fallback);
}

/** The newest page of the User's Item cards. Throws if the response breaks the contract. */
export async function fetchItems(): Promise<ListItemsResponse> {
  const res = await fetch(`${API_URL}/items`, {
    // The API knows the User from the Session cookie (ADR 0003).
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) throw await toApiError(res, "Failed to load items");
  return ListItemsResponseSchema.parse(await res.json());
}

/** Saves a link and returns the new Item's card. Throws if the response breaks the contract. */
export async function createItem(url: string): Promise<CreateItemResponse> {
  const res = await fetch(`${API_URL}/items`, {
    method: "POST",
    // The API knows the User from the Session cookie (ADR 0003).
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw await toApiError(res, "Failed to save item");
  return CreateItemResponseSchema.parse(await res.json());
}
