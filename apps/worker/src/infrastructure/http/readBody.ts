import type { IncomingMessage } from "node:http";

/**
 * Says whether enough of a body has arrived: called after each chunk with
 * that chunk, the bytes received so far and every chunk received.
 */
export type EnoughRead = (latest: Buffer, length: number, chunks: readonly Buffer[]) => boolean;

/**
 * Reads a response body chunk by chunk until `enough` says so, `limit` bytes
 * are in, or it ends, then hangs up (always, so nothing more is downloaded).
 * Returns at most `limit` bytes. Rejects once `signal` aborts (the fetch's
 * timeout).
 */
export async function readBody(
  response: IncomingMessage,
  signal: AbortSignal,
  limit: number,
  enough: EnoughRead = () => false,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    for await (const chunk of response as AsyncIterable<Buffer>) {
      if (signal.aborted) throw signal.reason;
      chunks.push(chunk);
      length += chunk.length;
      if (length >= limit || enough(chunk, length, chunks)) break;
    }
  } finally {
    response.destroy();
  }
  return Buffer.concat(chunks).subarray(0, limit);
}
