import { describe, expect, it } from "vitest";
import type { MetaTag, PageHead } from "@/domain/entities/PageHead";
import { itemTypeFromJsonLd } from "@/domain/rules/itemTypeFromJsonLd";
import { itemTypeFromOpenGraph } from "@/domain/rules/itemTypeFromOpenGraph";
import { itemTypeFromTwitterCard } from "@/domain/rules/itemTypeFromTwitterCard";

const head = (fields: Partial<PageHead> = {}): PageHead => ({
  meta: [],
  title: null,
  jsonLd: [],
  oEmbedLinks: [],
  ...fields,
});
const withMeta = (tags: Record<string, string>): PageHead =>
  head({ meta: Object.entries(tags).map(([key, content]): MetaTag => ({ key, content })) });

describe("itemTypeFromJsonLd", () => {
  it.each([
    ["Article", "article"],
    ["NewsArticle", "article"],
    ["BlogPosting", "article"],
    ["VideoObject", "video"],
    ["AudioObject", "audio"],
    ["PodcastEpisode", "audio"],
    ["MusicRecording", "audio"],
    ["SoftwareSourceCode", "code"],
    ["SocialMediaPosting", "post"],
    ["DiscussionForumPosting", "post"],
    ["ImageObject", "image"],
  ] as const)("types a %s as %s", (type, itemType) => {
    expect(itemTypeFromJsonLd(head({ jsonLd: [{ "@type": type }] }))).toBe(itemType);
  });

  it.each([
    ["schema:NewsArticle", "article"],
    ["https://schema.org/VideoObject", "video"],
    ["http://schema.org/PodcastEpisode", "audio"],
  ] as const)("reads a prefixed @type (%s)", (type, itemType) => {
    expect(itemTypeFromJsonLd(head({ jsonLd: [{ "@type": type }] }))).toBe(itemType);
  });

  it("reads an @type list", () => {
    expect(
      itemTypeFromJsonLd(head({ jsonLd: [{ "@type": ["CreativeWork", "BlogPosting"] }] })),
    ).toBe("article");
  });

  it("reads nodes in a top-level array and in an @graph", () => {
    expect(
      itemTypeFromJsonLd(head({ jsonLd: [[{ "@type": "WebSite" }, { "@type": "VideoObject" }]] })),
    ).toBe("video");
    expect(
      itemTypeFromJsonLd(
        head({
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@graph": [{ "@type": "WebPage" }, { "@type": "NewsArticle" }],
            },
          ],
        }),
      ),
    ).toBe("article");
  });

  it("takes the first recognised type in document order, across blocks", () => {
    expect(
      itemTypeFromJsonLd(
        head({
          jsonLd: [
            { "@type": "Organization" },
            { "@type": "PodcastEpisode" },
            { "@type": "Article" },
          ],
        }),
      ),
    ).toBe("audio");
  });

  it("doesn't call a page an Image for an ImageObject beside other things (a featured image)", () => {
    const yoastPage = {
      "@graph": [
        { "@type": "WebPage" },
        { "@type": "ImageObject", "@id": "#primaryimage" },
        { "@type": "WebSite" },
      ],
    };
    expect(itemTypeFromJsonLd(head({ jsonLd: [yoastPage] }))).toBeNull();
  });

  it("prefers any other recognised type over an ImageObject", () => {
    const post = { "@graph": [{ "@type": "ImageObject" }, { "@type": "BlogPosting" }] };
    expect(itemTypeFromJsonLd(head({ jsonLd: [post] }))).toBe("article");
  });

  it("doesn't look inside properties (an Article's embedded video stays an Article's)", () => {
    const article = { "@type": "WebPage", video: { "@type": "VideoObject" } };
    expect(itemTypeFromJsonLd(head({ jsonLd: [article] }))).toBeNull();
  });

  it.each([
    ["no blocks", []],
    ["unrecognised types", [{ "@type": "WebSite" }, { "@type": "Organization" }]],
    ["no @type", [{ name: "x" }]],
    [
      "odd values",
      [null, 42, "Article", { "@type": 7 }, { "@graph": "nope" }, { "@type": "constructor" }],
    ],
  ])("returns null for %s", (_case, jsonLd) => {
    expect(itemTypeFromJsonLd(head({ jsonLd }))).toBeNull();
  });
});

describe("itemTypeFromOpenGraph", () => {
  it.each([
    [{ "og:type": "article" }, "article"],
    [{ "og:type": "Article " }, "article"],
    [{ "og:type": "video.other" }, "video"],
    [{ "og:type": "video.movie" }, "video"],
    [{ "og:type": "video.episode" }, "video"],
    [{ "og:type": "website", "og:video": "https://example.com/v.mp4" }, "video"],
    [{ "og:video:url": "https://example.com/v.mp4" }, "video"],
    [{ "og:video:secure_url": "https://example.com/v.mp4" }, "video"],
    [{ "og:type": "music.song" }, "audio"],
    [{ "og:type": "music.album" }, "audio"],
    [{ "og:type": "music.playlist" }, "audio"],
    // og:type, when it says something, wins over an og:video tag.
    [{ "og:type": "article", "og:video": "https://example.com/v.mp4" }, "article"],
    [{ "og:type": "music.song", "og:video": "https://example.com/v.mp4" }, "audio"],
  ] as const)("types %o as %s", (tags, itemType) => {
    expect(itemTypeFromOpenGraph(withMeta(tags))).toBe(itemType);
  });

  it.each([
    [{}],
    [{ "og:type": "website" }],
    [{ "og:type": "profile" }],
    [{ "og:type": "book" }],
    [{ "og:video": "" }],
    [{ "twitter:card": "player" }],
  ])("returns null for %o", (tags) => {
    expect(itemTypeFromOpenGraph(withMeta(tags))).toBeNull();
  });
});

describe("itemTypeFromTwitterCard", () => {
  it.each([
    [{ "twitter:card": "player" }, "video"],
    [{ "twitter:card": "Player" }, "video"],
    [{ "twitter:card": "photo" }, "image"],
  ] as const)("types %o as %s", (tags, itemType) => {
    expect(itemTypeFromTwitterCard(withMeta(tags))).toBe(itemType);
  });

  it.each([
    [{}],
    [{ "twitter:card": "summary" }],
    [{ "twitter:card": "summary_large_image" }],
    [{ "twitter:card": "app" }],
  ])("returns null for %o", (tags) => {
    expect(itemTypeFromTwitterCard(withMeta(tags))).toBeNull();
  });
});
