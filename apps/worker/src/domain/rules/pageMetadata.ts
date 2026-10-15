import type { ItemMetadata } from "@/domain/entities/Item";
import { metaContent, type PageHead } from "@/domain/entities/PageHead";

export const MAX_TITLE_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 1000;

/** The title and description the page's Open Graph tags give, as written. */
export function openGraphMetadata(head: PageHead): ItemMetadata {
  return { title: metaContent(head, "og:title"), description: metaContent(head, "og:description") };
}

/** The title and description the page's Twitter Card gives, as written. */
export function twitterCardMetadata(head: PageHead): ItemMetadata {
  return {
    title: metaContent(head, "twitter:title"),
    description: metaContent(head, "twitter:description"),
  };
}

/** The page's own `<title>` and `<meta name="description">`, as written. */
export function documentMetadata(head: PageHead): ItemMetadata {
  return { title: head.title, description: metaContent(head, "description") };
}

/**
 * Picks the title and description, each from the first source (in the order
 * given) that has a non-blank one. Whitespace is collapsed and each is capped:
 * title at 300 characters, description at 1000, cut with an ellipsis.
 */
export function pickMetadata(sources: readonly ItemMetadata[]): ItemMetadata {
  return {
    title: firstClean(
      sources.map((source) => source.title),
      MAX_TITLE_LENGTH,
    ),
    description: firstClean(
      sources.map((source) => source.description),
      MAX_DESCRIPTION_LENGTH,
    ),
  };
}

function firstClean(candidates: readonly (string | null)[], maxLength: number): string | null {
  for (const candidate of candidates) {
    const text = candidate?.replace(/\s+/g, " ").trim();
    if (text) return capped(text, maxLength);
  }
  return null;
}

/** The text, cut to at most `maxLength` UTF-16 units with an ellipsis, never splitting a surrogate pair. */
function capped(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let cut = text.slice(0, maxLength - 1);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}
