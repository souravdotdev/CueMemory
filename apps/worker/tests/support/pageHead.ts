import type { MetaTag, PageHead } from "@/domain/entities/PageHead";

/** A parsed page head declaring only what's given. */
export const pageHead = (fields: Partial<PageHead> = {}): PageHead => ({
  meta: [],
  title: null,
  jsonLd: [],
  oEmbedLinks: [],
  ...fields,
});

/** A parsed page head declaring only these meta tags (key → content). */
export const headWithMeta = (tags: Record<string, string>): PageHead =>
  pageHead({ meta: Object.entries(tags).map(([key, content]): MetaTag => ({ key, content })) });
