import { describe, expect, it } from "vitest";
import { itemTypeFromJsonLd } from "@/domain/rules/itemTypeFromJsonLd";
import { pageHead as head } from "../../../support/pageHead";

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

  it("calls a page an Image when an ImageObject is the only kind of content it declares", () => {
    const photoPage = {
      "@graph": [
        { "@type": "WebPage" },
        { "@type": "ImageObject", "@id": "#photo" },
        { "@type": "WebSite" },
      ],
    };
    expect(itemTypeFromJsonLd(head({ jsonLd: [photoPage] }))).toBe("image");
  });

  it.each([
    ["before", [{ "@type": "ImageObject" }, { "@type": "BlogPosting" }], "article"],
    ["after", [{ "@type": "VideoObject" }, { "@type": "ImageObject" }], "video"],
    [
      "in another block",
      [{ "@type": "WebPage", image: { "@type": "ImageObject" } }, { "@type": "ImageObject" }],
      "image",
    ],
  ] as const)(
    "prefers any other kind of content over an ImageObject declared %s it",
    (_case, graph, itemType) => {
      expect(itemTypeFromJsonLd(head({ jsonLd: [{ "@graph": graph }] }))).toBe(itemType);
    },
  );

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
