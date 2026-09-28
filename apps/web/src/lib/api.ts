import type { ItemWithRelations } from "@cue-memory/types";
import { env } from "../env";

const API_URL = env.NEXT_PUBLIC_API_URL;

// TODO: replace with the authenticated user's id once auth is wired up.
const DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function fetchItems(): Promise<ItemWithRelations[]> {
  const res = await fetch(`${API_URL}/items`, {
    headers: { "x-user-id": DEV_USER_ID },
    cache: "no-store",
  });

  if (!res.ok) return [];
  return res.json();
}

export async function createItem(url: string) {
  const res = await fetch(`${API_URL}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": DEV_USER_ID,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : "Failed to save item");
  }

  return res.json();
}
