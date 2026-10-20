import { describe, expect, it } from "vitest";
import { UrlRefusedError, USER_AGENT } from "@/infrastructure/http/SafeUrlFetcher";
import { at, imageBytes, local, localFetcher, useLocalServer } from "../../../support/localServer";

useLocalServer();

describe("SafeUrlFetcher, image fetch, allowed images", () => {
  it("downloads an image whose Content-Type and magic bytes agree, asking for images", async () => {
    const image = await localFetcher().fetchImage(at("/img/png/png"));

    expect(Buffer.from(image)).toEqual(imageBytes("png"));
    expect(local.lastHeaders.accept).toBe("image/avif,image/webp,image/png,image/jpeg,image/gif");
    expect(local.lastHeaders["user-agent"]).toBe(USER_AGENT);
  });

  it.each([
    ["JPEG", "/img/jpeg/jpeg"],
    ["JPEG sent as image/jpg", "/img/jpg/jpeg"],
    ["GIF", "/img/gif/gif"],
    ["WebP", "/img/webp/webp"],
    ["AVIF", "/img/avif/avif"],
  ])("accepts %s", async (_format, path) => {
    await expect(localFetcher().fetchImage(at(path))).resolves.toBeDefined();
  });

  it("follows a redirect to the image", async () => {
    await expect(localFetcher().fetchImage(at("/to-image"))).resolves.toBeDefined();
    expect(local.hits).toEqual(["/to-image", "/img/png/png"]);
  });

  it("reads an image of exactly 5 MB", async () => {
    const image = await localFetcher().fetchImage(at("/image-just-under"));

    expect(image).toHaveLength(5 * 1024 * 1024);
  });
});

describe("SafeUrlFetcher, image fetch, refusals", () => {
  it.each([
    ["an SVG", "/img/svg/svg"],
    ["an ICO", "/img/ico/ico"],
    ["a HEIC", "/img/heic/heic"],
    ["HTML", "/img/html/html"],
    ["an untyped download, even of PNG bytes", "/img/octet/png"],
  ])("refuses %s", async (_case, path) => {
    await expect(localFetcher().fetchImage(at(path))).rejects.toThrow(/isn't an accepted image/);
  });

  it.each([
    ["PNG bytes sent as JPEG", "/img/jpeg/png"],
    ["HTML disguised as a PNG", "/img/png/html"],
    ["an SVG disguised as a PNG", "/img/png/svg"],
    ["a HEIC disguised as AVIF", "/img/avif/heic"],
  ])("refuses %s", async (_case, path) => {
    await expect(localFetcher().fetchImage(at(path))).rejects.toThrow(/doesn't start like/);
  });

  it("refuses an image that says it is over 5 MB, without reading it", async () => {
    await expect(
      localFetcher({ timeoutMs: 2000 }).fetchImage(at("/image-big-header")),
    ).rejects.toThrow(/more than 5242880 bytes/);
  });

  it("stops reading an image that runs past 5 MB", async () => {
    await expect(
      localFetcher({ timeoutMs: 5000 }).fetchImage(at("/image-endless")),
    ).rejects.toThrow(/more than 5242880 bytes/);
  });

  it.each([
    ["a 404", "/image-missing", /answered 404/],
    ["a server error", "/broken", /answered 503/],
  ])("refuses %s", async (_case, path, reason) => {
    await expect(localFetcher().fetchImage(at(path))).rejects.toThrow(reason);
  });

  it("refuses a redirect into the network", async () => {
    await expect(localFetcher().fetchImage(at("/image-to-private"))).rejects.toThrow(
      UrlRefusedError,
    );
    expect(local.hits).toEqual(["/image-to-private"]);
  });

  it("refuses an image on a host that resolves to a private address", async () => {
    await expect(localFetcher().fetchImage("http://internal.test/photo.png")).rejects.toThrow(
      /resolves to 10\.0\.0\.5/,
    );
  });

  it("times out like a page", async () => {
    await expect(localFetcher({ timeoutMs: 200 }).fetchImage(at("/hang"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });
});
