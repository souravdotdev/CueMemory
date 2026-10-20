import { mediaTypeOf } from "@/domain/rules/mediaType";

/** The image formats a Thumbnail is made from. SVG (it can carry script), ICO and everything else are refused. */
export type ThumbnailImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif";

/** The most of an image downloaded for a Thumbnail: 5 MB. */
export const THUMBNAIL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const FORMAT_OF_MEDIA_TYPE: Record<string, ThumbnailImageFormat> = {
  "image/jpeg": "jpeg",
  // A common misspelling servers still send.
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** The `Accept` header an image download sends: only the accepted formats. */
export const THUMBNAIL_IMAGE_ACCEPT = "image/avif,image/webp,image/png,image/jpeg,image/gif";

/** The accepted image format a `Content-Type` declares, or null for any other (or none). */
export function thumbnailImageFormatOfContentType(
  contentType: string | null,
): ThumbnailImageFormat | null {
  return FORMAT_OF_MEDIA_TYPE[mediaTypeOf(contentType)] ?? null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.length <= bytes.length && signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Whether an image's bytes start the way its declared format's files do (its
 * magic bytes), so a file can't pass under another format's Content-Type.
 * AVIF is an ISO base media file whose `ftyp` box names `avif` (or `avis`)
 * as its major brand or, after a generic `mif1`/`msf1`, among its compatible
 * brands; HEIC, the same box naming `heic`, doesn't pass.
 */
export function startsLike(format: ThumbnailImageFormat, bytes: Uint8Array): boolean {
  switch (format) {
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "gif":
      return ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6));
    case "webp":
      return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
    case "avif":
      return isAvif(bytes);
  }
}

const AVIF_BRANDS = new Set(["avif", "avis"]);

function isAvif(bytes: Uint8Array): boolean {
  if (ascii(bytes, 4, 8) !== "ftyp") return false;
  const major = ascii(bytes, 8, 12);
  if (AVIF_BRANDS.has(major)) return true;
  if (major !== "mif1" && major !== "msf1") return false;
  // The box's size (big-endian, bytes 0–4) bounds its compatible brands, from byte 16.
  const boxEnd = Math.min(
    bytes.length,
    ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0,
  );
  for (let at = 16; at + 4 <= boxEnd; at += 4) {
    if (AVIF_BRANDS.has(ascii(bytes, at, at + 4))) return true;
  }
  return false;
}
