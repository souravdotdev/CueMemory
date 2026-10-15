import type { ItemType } from "@/domain/entities/Item";
import type { PageHead } from "@/domain/entities/PageHead";

// schema.org types a page's JSON-LD can declare, and the Item type each one
// means. A Map, so a type such as "constructor" never reads a prototype key.
const SCHEMA_TYPES = new Map<string, ItemType>([
  ["Article", "article"],
  ["NewsArticle", "article"],
  ["BlogPosting", "article"],
  ["VideoObject", "video"],
  ["AudioObject", "audio"],
  ["PodcastEpisode", "audio"],
  ["MusicRecording", "audio"],
  ["SoftwareSourceCode", "code"],
  ["SocialMediaPosting", "post"],
  ["DiscussionForumPosting", "post"],
  ["ImageObject", "image"],
]);

/** The `@type` names of every top-level node: blocks, arrays of nodes and `@graph` members. */
function* nodeTypes(value: unknown): Generator<string> {
  if (Array.isArray(value)) {
    for (const node of value) yield* nodeTypes(node);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const node = value as Record<string, unknown>;
  const types: unknown[] = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  for (const type of types) {
    // "schema:Article" and "https://schema.org/Article" name the same type.
    if (typeof type === "string") yield type.replace(/^.*[/:]/, "");
  }
  if (Array.isArray(node["@graph"])) yield* nodeTypes(node["@graph"]);
}

/**
 * Works out an Item type from the page's JSON-LD `@type`s: the first one,
 * in document order, that names a kind of content. An ImageObject only counts
 * when the page declares nothing else (a page with a featured image is not an
 * Image). Null when nothing recognised is declared.
 */
export function itemTypeFromJsonLd(head: PageHead): ItemType | null {
  const types = [...nodeTypes(head.jsonLd)];
  for (const type of types) {
    const itemType = SCHEMA_TYPES.get(type);
    if (itemType && itemType !== "image") return itemType;
  }
  const onlyImages = types.length > 0 && types.every((type) => type === "ImageObject");
  return onlyImages ? "image" : null;
}
