/**
 * Downloads an image a Thumbnail could be made from. The implementation goes
 * through the same guard, redirect checks and timeout as the page fetch (see
 * docs/security.md), accepts only a 2xx JPEG, PNG, WebP, GIF or AVIF whose
 * Content-Type and magic bytes agree, of at most 5 MB, and rejects anything
 * else; Processing then keeps no Thumbnail.
 */
export interface IImageFetcher {
  fetchImage(url: string): Promise<Uint8Array>;
}
