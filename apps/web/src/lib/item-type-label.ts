import type { ItemType } from "@resonory/shared/schemas/items";

const LABELS: Record<ItemType, string> = {
  article: "Article",
  post: "Post",
  video: "Video",
  image: "Image",
  audio: "Audio",
  pdf: "PDF",
  code: "Code",
  file: "File",
  link: "Link",
};

/** The name a User sees for an Item type; null while the Item has none yet (Processing). */
export function itemTypeLabel(type: ItemType | null): string | null {
  return type === null ? null : LABELS[type];
}
