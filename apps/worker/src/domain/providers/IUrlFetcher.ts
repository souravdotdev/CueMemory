/** What one fetch of a Source URL tells Processing about the page behind it. */
export interface FetchedPage {
  /** The final response's `Content-Type` header as sent, or null without one. */
  contentType: string | null;
  /** The start of an HTML response, up to and including `</head>` (capped in size); null for anything else. */
  htmlHead: string | null;
}

/**
 * Fetches a Source URL once so its response can decide the Item type. The
 * implementation refuses addresses inside the network (see docs/security.md);
 * a refused, failed or timed-out fetch rejects.
 */
export interface IUrlFetcher {
  fetchPage(url: string): Promise<FetchedPage>;
}
