/**
 * Turns a stored Thumbnail key into a short-lived URL a User's browser can load.
 * The storage adapter implements it; the bucket itself stays private.
 */
export interface ThumbnailUrlResolver {
  resolve(thumbnailKey: string): Promise<string>;
}
