import { injectable, unmanaged } from "inversify";
import sharp from "sharp";
import type { IThumbnailResizer } from "@/domain/providers/IThumbnailResizer";
import { isThumbnailImageFormat } from "@/domain/rules/thumbnailImage";

/** A card Thumbnail's widest. */
export const CARD_THUMBNAIL_WIDTH = 800;
/** The most pixels (width × height) an image may declare: 40 MP, a large phone photo's ~3×. */
export const MAX_INPUT_PIXELS = 40_000_000;

export interface SharpThumbnailResizerOptions {
  /** Defaults to `MAX_INPUT_PIXELS`; tests lower it to refuse tiny fixtures. */
  maxInputPixels?: number;
}

/**
 * Makes card Thumbnails with sharp (libvips). sharp decodes far more than the
 * accepted formats (SVG, TIFF, HEIC …), so anything whose decoded format
 * isn't one of them (thumbnailImage.ts) is refused here too, not only by the
 * fetch. The pixel cap is checked against the image's header before any
 * pixel is decoded, so a decompression bomb is refused cheaply; sharp reads
 * only the first frame of an animated image unless asked for more. Output
 * metadata (EXIF, GPS, XMP, ICC) is stripped by sharp's default.
 */
@injectable()
export class SharpThumbnailResizer implements IThumbnailResizer {
  private readonly maxInputPixels: number;

  // Not injected: the container leaves it undefined, so the defaults apply.
  constructor(@unmanaged() options: SharpThumbnailResizerOptions = {}) {
    this.maxInputPixels = options.maxInputPixels ?? MAX_INPUT_PIXELS;
  }

  async toCardThumbnail(image: Uint8Array): Promise<Uint8Array> {
    const decoder = () =>
      sharp(image, { limitInputPixels: this.maxInputPixels, autoOrient: true, failOn: "warning" });

    const { format, compression } = await decoder().metadata();
    if (!isAcceptedFormat(format, compression)) {
      throw new Error(`A Thumbnail is never made from ${format ?? "an unknown format"}`);
    }
    return decoder()
      .resize({ width: CARD_THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp()
      .toBuffer();
  }
}

/**
 * An accepted Thumbnail image format by sharp's name for it. sharp names AVIF
 * `heif` with AV1 compression; HEIC's HEVC isn't accepted.
 */
function isAcceptedFormat(format: string | undefined, compression: string | undefined): boolean {
  return isThumbnailImageFormat(format === "heif" && compression === "av1" ? "avif" : format);
}
