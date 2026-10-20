import { metaContent, type PageHead } from "@/domain/entities/PageHead";
import { httpUrl } from "@/domain/rules/parsedUrl";

/** What Processing learned about an Item that could offer it a Thumbnail. */
export interface ThumbnailOffers {
  /** The URL the fetch ended at, after redirects; relative offers are resolved against it. */
  finalUrl: string;
  /** Whether the Item is an Image whose fetch ended at the image itself. */
  isImage: boolean;
  /** The page's head, or null for anything but an HTML page (or when the page fetch failed). */
  head: PageHead | null;
  /** The oEmbed answer's `thumbnail_url`, or null without an answer or one. */
  oEmbedThumbnailUrl: string | null;
}

/**
 * The images a Thumbnail could be made from, best first; Processing keeps
 * the first that downloads, resizes and stores. For an Image, only the image
 * itself (its final URL). Otherwise the oEmbed answer's `thumbnail_url` (a
 * provider's deliberate answer beats page markup, as for the title), then
 * what the page advertises: `og:image`, then `twitter:image`. Each value is
 * made absolute against the final URL; blank values and ones that aren't
 * http(s) (`data:`, `javascript:` …) are dropped, and an image offered twice
 * is offered once, in its first place.
 * This is the one place the order is written down.
 */
export function thumbnailCandidates({
  finalUrl,
  isImage,
  head,
  oEmbedThumbnailUrl,
}: ThumbnailOffers): string[] {
  if (isImage) return [finalUrl];
  const offered = [oEmbedThumbnailUrl];
  if (head) offered.push(metaContent(head, "og:image"), metaContent(head, "twitter:image"));
  const candidates = offered.flatMap((value) => {
    const url = httpUrl(value, finalUrl);
    return url ? [url] : [];
  });
  return [...new Set(candidates)];
}
