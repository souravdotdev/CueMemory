/** What an oEmbed endpoint says about a page, as far as Processing reads it. */
export interface OEmbed {
  /** The answer's `type` (`video`, `photo`, `rich` or `link`), as sent; null without one. */
  type: string | null;
  /** The answer's `title`, or (without one) the text of a post the embed quotes; null if neither. */
  title: string | null;
}

/**
 * Asks one oEmbed endpoint about a page. The implementation goes through the
 * same guard as the page fetch (see docs/security.md), accepts only a small
 * JSON answer, and rejects on a refusal, a failure, a timeout or an answer it
 * can't read; Processing then falls through to the page's other signals.
 */
export interface IOEmbedProvider {
  fetchOEmbed(endpointUrl: string): Promise<OEmbed>;
}
