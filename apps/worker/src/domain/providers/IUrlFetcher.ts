import type { PageHead } from "@/domain/entities/PageHead";

/**
 * What one fetch of a Source URL tells Processing about the page behind it,
 * by what the final response was. Each kind carries the URL the fetch ended
 * at, after following redirects (the Source URL when there were none).
 */
export type FetchedPage = HtmlPage | FetchedFile | UnsuccessfulAnswer;

/** A 2xx HTML page: declared `text/html` (or XHTML), or sent without a Content-Type but starting like HTML. */
export interface HtmlPage {
  kind: "html";
  finalUrl: string;
  /** The `Content-Type` header as sent, or null without one. */
  contentType: string | null;
  /** The tags of the page's head (read up to `</head>`, capped in size). */
  head: PageHead;
}

/** A 2xx answer that isn't HTML: a download, an image, a PDF … */
export interface FetchedFile {
  kind: "file";
  finalUrl: string;
  /** The `Content-Type` header as sent, or null without one. */
  contentType: string | null;
  /** The body's first ~16 bytes (fewer if it is shorter). */
  firstBytes: Uint8Array;
}

/** An answer that says nothing about the page (a 404, a 403 …), read no further. */
export interface UnsuccessfulAnswer {
  kind: "unsuccessful";
  finalUrl: string;
  status: number;
}

/**
 * Fetches a Source URL once so its response can decide the Item type, title
 * and description. The implementation refuses addresses inside the network
 * (see docs/security.md); a refused, failed or timed-out fetch rejects, and
 * so does a server error or a rate limit (5xx, 429), which may pass.
 */
export interface IUrlFetcher {
  fetchPage(sourceUrl: string): Promise<FetchedPage>;
}
