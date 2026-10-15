/**
 * Fetches a small JSON document (an oEmbed answer) and parses it. The
 * implementation goes through the same guard, redirect checks and timeout as
 * the page fetch (see docs/security.md) and rejects on a refusal, a failure,
 * an unsuccessful answer, a non-JSON Content-Type or a body over its size cap.
 */
export interface IJsonFetcher {
  fetchJson(url: string): Promise<unknown>;
}
