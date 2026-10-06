import { errorDtoSchema } from "@cue-memory/contracts/common";
import {
  createItemResponseDtoSchema,
  listItemsResponseDtoSchema,
  type CreateItemResponseDto,
  type ListItemsResponseDto,
} from "@cue-memory/contracts/items";
import { env } from "../env";

const API_URL = env.NEXT_PUBLIC_API_URL;

// TODO: replace with the authenticated user's id once auth is wired up.
const DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

// Every non-2xx response should carry the common error envelope; surface its message.
async function toApiError(res: Response, fallback: string): Promise<Error> {
  const body: unknown = await res.json().catch(() => null);
  const parsed = errorDtoSchema.safeParse(body);
  return new Error(parsed.success ? parsed.data.error.message : fallback);
}

/** The newest page of the User's Item cards. Throws if the response breaks the contract. */
export async function fetchItems(): Promise<ListItemsResponseDto> {
  const res = await fetch(`${API_URL}/items`, {
    headers: { "x-user-id": DEV_USER_ID },
    cache: "no-store",
  });

  if (!res.ok) throw await toApiError(res, "Failed to load items");
  return listItemsResponseDtoSchema.parse(await res.json());
}

/** Saves a link and returns the new Item's card. Throws if the response breaks the contract. */
export async function createItem(url: string): Promise<CreateItemResponseDto> {
  const res = await fetch(`${API_URL}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": DEV_USER_ID,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw await toApiError(res, "Failed to save item");
  return createItemResponseDtoSchema.parse(await res.json());
}
