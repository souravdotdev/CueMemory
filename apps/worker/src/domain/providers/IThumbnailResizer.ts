/**
 * Turns a downloaded image into a card Thumbnail: WebP, at most 800px wide
 * (never enlarged), turned the way its EXIF orientation says, with all
 * metadata stripped, one frame of an animated image. The implementation
 * caps the decoded pixel count and rejects an image it refuses (too big,
 * not one of the accepted formats) or can't decode; Processing then keeps
 * no Thumbnail.
 */
export interface IThumbnailResizer {
  toCardThumbnail(image: Uint8Array): Promise<Uint8Array>;
}
