import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { SharpThumbnailResizer } from "@/infrastructure/images/SharpThumbnailResizer";

// Tiny images made in the test, so every fixture says exactly what it holds.
const solid = (width: number, height: number, background = "red") =>
  sharp({ create: { width, height, channels: 3, background } });

const png = (width: number, height: number, background?: string) =>
  solid(width, height, background).png().toBuffer();

/** What sharp reads back from a stored Thumbnail. */
const inspect = (thumbnail: Uint8Array) => sharp(thumbnail).metadata();

describe("SharpThumbnailResizer, the card Thumbnail", () => {
  const resizer = new SharpThumbnailResizer();

  it("writes WebP", async () => {
    const thumbnail = await resizer.toCardThumbnail(await png(40, 20));

    expect(await inspect(thumbnail)).toMatchObject({ format: "webp", width: 40, height: 20 });
  });

  it("fits a wide image to 800px wide, keeping its shape", async () => {
    const thumbnail = await resizer.toCardThumbnail(await png(1600, 400));

    expect(await inspect(thumbnail)).toMatchObject({ width: 800, height: 200 });
  });

  it("never enlarges a small image", async () => {
    const thumbnail = await resizer.toCardThumbnail(await png(300, 500));

    expect(await inspect(thumbnail)).toMatchObject({ width: 300, height: 500 });
  });

  it.each([
    ["JPEG", (image: Sharp) => image.jpeg()],
    ["WebP", (image: Sharp) => image.webp()],
    ["GIF", (image: Sharp) => image.gif()],
    ["AVIF", (image: Sharp) => image.avif()],
  ])("accepts %s", async (_format, encode) => {
    const thumbnail = await resizer.toCardThumbnail(await encode(solid(16, 8)).toBuffer());

    expect(await inspect(thumbnail)).toMatchObject({ format: "webp", width: 16, height: 8 });
  });

  it("turns a photo the way its EXIF orientation says, then strips all metadata", async () => {
    // Stored 40×20 and tagged "rotate 90°", with a camera make and a GPS tag.
    const photo = await solid(40, 20)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Make: "Camera" }, IFD3: { GPSLatitudeRef: "N" } })
      .toBuffer();
    expect((await inspect(photo)).exif).toBeDefined();

    const metadata = await inspect(await resizer.toCardThumbnail(photo));

    expect(metadata).toMatchObject({ width: 20, height: 40 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("keeps only the first frame of an animated image", async () => {
    const frames = [await png(40, 20, "red"), await png(40, 20, "blue")];
    const animated = await sharp(frames, { join: { animated: true } })
      .gif()
      .toBuffer();
    expect((await inspect(animated)).pages).toBe(2);

    const thumbnail = await resizer.toCardThumbnail(animated);

    const metadata = await inspect(thumbnail);
    expect(metadata).toMatchObject({ width: 40, height: 20 });
    expect(metadata.pages ?? 1).toBe(1);
    // The first frame is the red one.
    const { data } = await sharp(thumbnail).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(200);
    expect(data[2]).toBeLessThan(50);
  });
});

describe("SharpThumbnailResizer, refusals", () => {
  it("refuses an image over the pixel cap, before decoding it", async () => {
    const resizer = new SharpThumbnailResizer({ maxInputPixels: 100 * 100 });

    await expect(resizer.toCardThumbnail(await png(101, 100))).rejects.toThrow(/pixel limit/);
    await expect(resizer.toCardThumbnail(await png(100, 100))).resolves.toBeDefined();
  });

  it("refuses an image that isn't one of the accepted formats, such as SVG", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );

    await expect(new SharpThumbnailResizer().toCardThumbnail(svg)).rejects.toThrow(/svg/);
  });

  it("refuses a TIFF, which sharp could decode", async () => {
    const tiff = await solid(8, 8).tiff().toBuffer();

    await expect(new SharpThumbnailResizer().toCardThumbnail(tiff)).rejects.toThrow(/tiff/);
  });

  it.each([
    ["bytes that aren't an image", Buffer.from("not an image at all")],
    ["a cut-off PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])],
  ])("refuses %s", async (_case, bytes) => {
    await expect(new SharpThumbnailResizer().toCardThumbnail(bytes)).rejects.toThrow();
  });
});
