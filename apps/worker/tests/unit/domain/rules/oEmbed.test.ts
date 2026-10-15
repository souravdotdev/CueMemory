import { describe, expect, it } from "vitest";
import type { OEmbedLink, PageHead } from "@/domain/entities/PageHead";
import type { OEmbed } from "@/domain/providers/IOEmbedProvider";
import { itemTypeFromOEmbed, oEmbedRequestFor } from "@/domain/rules/oEmbed";

const head = (oEmbedLinks: OEmbedLink[] = []): PageHead => ({
  meta: [],
  title: null,
  jsonLd: [],
  oEmbedLinks,
});
const endpointOf = (url: string) => new URL(url).origin + new URL(url).pathname;
const urlParamOf = (url: string) => new URL(url).searchParams.get("url");

describe("oEmbedRequestFor, known providers", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/oembed", "YouTube"],
    ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/oembed", "YouTube"],
    ["https://youtube.com/shorts/abc123", "https://www.youtube.com/oembed", "YouTube"],
    ["https://vimeo.com/76979871", "https://vimeo.com/api/oembed.json", "Vimeo"],
    ["https://x.com/someone/status/1234567890", "https://publish.twitter.com/oembed", "X"],
    ["https://twitter.com/someone/status/1234567890", "https://publish.twitter.com/oembed", "X"],
    [
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      "https://open.spotify.com/oembed",
      "Spotify",
    ],
    ["https://open.spotify.com/episode/abc", "https://open.spotify.com/oembed", "Spotify"],
    ["https://soundcloud.com/artist/a-track", "https://soundcloud.com/oembed", "SoundCloud"],
    [
      "https://www.reddit.com/r/typescript/comments/abc123/a_thread/",
      "https://www.reddit.com/oembed",
      "Reddit",
    ],
    [
      "https://www.tiktok.com/@someone/video/7234567890123456789",
      "https://www.tiktok.com/oembed",
      "TikTok",
    ],
  ])("asks %s's provider at its endpoint", (pageUrl, endpoint, provider) => {
    const request = oEmbedRequestFor(pageUrl, head());

    expect(request?.provider?.name).toBe(provider);
    expect(endpointOf(request!.endpointUrl)).toBe(endpoint);
    expect(urlParamOf(request!.endpointUrl)).toBe(pageUrl);
    expect(new URL(request!.endpointUrl).searchParams.get("format")).toBe("json");
  });

  it("prefers a known provider's endpoint over the page's discovery link", () => {
    const request = oEmbedRequestFor(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      head([{ url: "https://evil.example/oembed?url=x", format: "json" }]),
    );

    expect(endpointOf(request!.endpointUrl)).toBe("https://www.youtube.com/oembed");
  });

  it.each([
    "https://www.youtube.com/@someone",
    "https://x.com/someone",
    "https://open.spotify.com/artist/abc",
    "https://www.reddit.com/r/typescript/",
    "https://example.com/page",
  ])("knows no provider endpoint for %s", (pageUrl) => {
    expect(oEmbedRequestFor(pageUrl, head())).toBeNull();
    expect(oEmbedRequestFor(pageUrl, null)).toBeNull();
  });
});

describe("oEmbedRequestFor, discovery links", () => {
  it("uses the page's first JSON discovery link as written", () => {
    const request = oEmbedRequestFor(
      "https://example.com/post",
      head([
        { url: "https://example.com/oembed?url=a&format=xml", format: "xml" },
        { url: "https://example.com/oembed?url=a&format=json", format: "json" },
        { url: "https://example.com/other?url=a", format: "json" },
      ]),
    );

    expect(request).toEqual({
      endpointUrl: "https://example.com/oembed?url=a&format=json",
      provider: null,
    });
  });

  it("recognises a known provider behind a discovery link", () => {
    const request = oEmbedRequestFor(
      "https://www.youtube.com/@someone/featured",
      head([{ url: "https://www.youtube.com/oembed?url=x&format=json", format: "json" }]),
    );

    expect(request?.provider?.name).toBe("YouTube");
  });

  it("asks nothing of a page with only XML discovery links", () => {
    expect(
      oEmbedRequestFor(
        "https://example.com/post",
        head([{ url: "https://example.com/oembed?format=xml", format: "xml" }]),
      ),
    ).toBeNull();
  });
});

describe("itemTypeFromOEmbed", () => {
  const answer = (type: string | null): OEmbed => ({ type, title: null });
  const provider = (pageUrl: string) => oEmbedRequestFor(pageUrl, null)!.provider;

  it.each([
    ["video", null, "video"],
    ["photo", null, "image"],
    ["VIDEO", null, "video"],
    ["rich", "https://x.com/someone/status/1", "post"],
    ["rich", "https://www.reddit.com/r/a/comments/b/c/", "post"],
    ["rich", "https://open.spotify.com/track/abc", "audio"],
    ["rich", "https://soundcloud.com/artist/a-track", "audio"],
    ["rich", "https://www.tiktok.com/@someone/video/1", "video"],
    ["rich", "https://www.youtube.com/watch?v=abc", "video"],
    ["rich", null, null],
    ["link", "https://x.com/someone/status/1", null],
    ["link", null, null],
    [null, null, null],
    ["something-else", null, null],
  ] as const)("types a %s answer from %s as %s", (type, pageUrl, itemType) => {
    expect(itemTypeFromOEmbed(answer(type), pageUrl ? provider(pageUrl) : null)).toBe(itemType);
  });
});
