import type { PageHead } from "@/domain/entities/PageHead";

/** What one fetch of a Source URL tells Processing about the page behind it. */
export interface FetchedPage {
  /** The URL the fetch ended at, after following redirects (the Source URL when there were none). */
  finalUrl: string;
  /** The final response's `Content-Type` header as sent, or null without one. */
  contentType: string | null;
  /** The tags of an HTML response's head (read up to `</head>`, capped in size); null for anything else. */
  head: PageHead | null;
  /** The first ~16 bytes of a response that isn't HTML (fewer if the body is shorter); null for HTML or an unsuccessful answer. */
  firstBytes: Uint8Array | null;
}

/**
 * Fetches a Source URL once so its response can decide the Item type, title
 * and description. The implementation refuses addresses inside the network
 * (see docs/security.md); a refused, failed or timed-out fetch rejects.
 */
export interface IUrlFetcher {
  fetchPage(sourceUrl: string): Promise<FetchedPage>;
}
