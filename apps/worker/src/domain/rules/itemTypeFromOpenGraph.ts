import type { ItemType } from "@/domain/entities/Item";
import { metaContent, type PageHead } from "@/domain/entities/PageHead";

const VIDEO_TAGS = ["og:video", "og:video:url", "og:video:secure_url"];

/**
 * Works out an Item type from the page's Open Graph tags: `og:type` article
 * is an Article, `video.*` a Video and `music.*` Audio; otherwise an
 * `og:video` tag makes it a Video. Null when they say nothing more.
 */
export function itemTypeFromOpenGraph(head: PageHead): ItemType | null {
  const type = metaContent(head, "og:type")?.trim().toLowerCase() ?? "";
  if (type === "article") return "article";
  if (type.startsWith("video.")) return "video";
  if (type.startsWith("music.")) return "audio";
  if (VIDEO_TAGS.some((key) => metaContent(head, key)?.trim())) return "video";
  return null;
}
