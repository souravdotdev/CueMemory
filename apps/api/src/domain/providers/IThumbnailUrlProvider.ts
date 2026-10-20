/**
 * Turns a stored Thumbnail key into a short-lived URL a User's browser can load,
 * or null when it can't be signed (the object is gone, the key is bad …): the
 * card then shows no Thumbnail. The storage adapter implements it; the bucket
 * itself stays private.
 */
export interface IThumbnailUrlProvider {
  resolve(thumbnailKey: string): Promise<string | null>;
}
