/** One `<meta>` tag: its `property` (or, without one, `name`) lower-case, and its `content`. */
export interface MetaTag {
  key: string;
  content: string;
}

/** An oEmbed discovery link (`<link rel="alternate" type="application/json+oembed" href="…">`). */
export interface OEmbedLink {
  /** The endpoint URL, made absolute against the page's URL. */
  url: string;
  format: "json" | "xml";
}

/**
 * What a web page's `<head>` declares about itself, extracted once from the
 * fetched HTML (entities decoded) so the rules read tags, never markup.
 */
export interface PageHead {
  /** Every `<meta>` tag with a key and content, in document order. */
  meta: readonly MetaTag[];
  /** The first `<title>`'s text, or null without one. */
  title: string | null;
  /** Each `<script type="application/ld+json">` block that parses as JSON, in document order. */
  jsonLd: readonly unknown[];
  /** The page's oEmbed discovery links, in document order. */
  oEmbedLinks: readonly OEmbedLink[];
}

/** The content of the head's first `<meta>` tag with this key (lower-case), or null without one. */
export function metaContent(head: PageHead, key: string): string | null {
  return head.meta.find((tag) => tag.key === key)?.content ?? null;
}
