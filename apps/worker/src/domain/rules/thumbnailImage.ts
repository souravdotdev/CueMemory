import { isAvif, isGif, isJpeg, isPng, isWebp } from "@/domain/rules/magicBytes";
import { mediaTypeOf } from "@/domain/rules/mediaType";

/**
 * The image formats a Thumbnail is made from, in the order a download asks
 * for them: the media types that declare each (the first is its own; the
 * rest are misspellings servers still send) and the magic bytes its files
 * start with. SVG (it can carry script), ICO, HEIC and everything else are
 * refused.
 */
const THUMBNAIL_IMAGE_FORMATS = {
  avif: { mediaTypes: ["image/avif"], startsLike: isAvif },
  webp: { mediaTypes: ["image/webp"], startsLike: isWebp },
  png: { mediaTypes: ["image/png"], startsLike: isPng },
  jpeg: { mediaTypes: ["image/jpeg", "image/jpg"], startsLike: isJpeg },
  gif: { mediaTypes: ["image/gif"], startsLike: isGif },
} as const satisfies Record<
  string,
  { mediaTypes: readonly [string, ...string[]]; startsLike: (bytes: Uint8Array) => boolean }
>;

export type ThumbnailImageFormat = keyof typeof THUMBNAIL_IMAGE_FORMATS;

const FORMATS = Object.entries(THUMBNAIL_IMAGE_FORMATS) as [
  ThumbnailImageFormat,
  (typeof THUMBNAIL_IMAGE_FORMATS)[ThumbnailImageFormat],
][];

/** The most of an image downloaded for a Thumbnail: 5 MB. */
export const THUMBNAIL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const FORMAT_OF_MEDIA_TYPE = new Map<string, ThumbnailImageFormat>(
  FORMATS.flatMap(([format, { mediaTypes }]) => mediaTypes.map((type) => [type, format] as const)),
);

/** The `Accept` header an image download sends: only the accepted formats. */
export const THUMBNAIL_IMAGE_ACCEPT = FORMATS.map(([, { mediaTypes }]) => mediaTypes[0]).join(",");

/** Whether `format` (an image decoder's name for one) is an accepted Thumbnail image format. */
export function isThumbnailImageFormat(format: string | undefined): format is ThumbnailImageFormat {
  return format !== undefined && Object.hasOwn(THUMBNAIL_IMAGE_FORMATS, format);
}

/** The accepted image format a `Content-Type` declares, or null for any other (or none). */
export function thumbnailImageFormatOfContentType(
  contentType: string | null,
): ThumbnailImageFormat | null {
  return FORMAT_OF_MEDIA_TYPE.get(mediaTypeOf(contentType)) ?? null;
}

/**
 * Whether an image's bytes start the way its declared format's files do (its
 * magic bytes), so a file can't pass under another format's Content-Type.
 */
export function startsLike(format: ThumbnailImageFormat, bytes: Uint8Array): boolean {
  return THUMBNAIL_IMAGE_FORMATS[format].startsLike(bytes);
}
