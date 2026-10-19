import type { ItemType } from "@/domain/entities/Item";
import { metaContent, type PageHead } from "@/domain/entities/PageHead";

/**
 * Works out an Item type from the page's Twitter Card: a `player` card is a
 * Video and a `photo` card an Image. Null for any other card or none.
 */
export function itemTypeFromTwitterCard(head: PageHead): ItemType | null {
  const card = metaContent(head, "twitter:card")?.trim().toLowerCase();
  if (card === "player") return "video";
  if (card === "photo") return "image";
  return null;
}
