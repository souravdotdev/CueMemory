import { describe, expect, it } from "vitest";
import type { MetaTag, PageHead } from "@/domain/entities/PageHead";
import { thumbnailCandidates } from "@/domain/rules/thumbnailCandidates";

const PAGE_URL = "https://example.com/blog/post";

const head = (tags: [string, string][]): PageHead => ({
  meta: tags.map(([key, content]): MetaTag => ({ key, content })),
  title: null,
  jsonLd: [],
  oEmbedLinks: [],
});

const pageCandidates = (tags: [string, string][], finalUrl = PAGE_URL) =>
  thumbnailCandidates({ finalUrl, isImage: false, head: head(tags) });

describe("Thumbnail candidates", () => {
  it("offers a page's og:image", () => {
    expect(pageCandidates([["og:image", "https://cdn.example.com/cover.jpg"]])).toEqual([
      "https://cdn.example.com/cover.jpg",
    ]);
  });

  it("offers og:image first, then twitter:image, whatever their order in the head", () => {
    const tags: [string, string][] = [
      ["twitter:image", "https://cdn.example.com/card.png"],
      ["og:image", "https://cdn.example.com/cover.jpg"],
    ];

    expect(pageCandidates(tags)).toEqual([
      "https://cdn.example.com/cover.jpg",
      "https://cdn.example.com/card.png",
    ]);
  });

  it("offers a page's twitter:image when it has no og:image", () => {
    expect(pageCandidates([["twitter:image", "https://cdn.example.com/card.png"]])).toEqual([
      "https://cdn.example.com/card.png",
    ]);
  });

  it.each([
    ["/cover.jpg", "https://www.example.org/cover.jpg"],
    ["images/cover.jpg", "https://www.example.org/news/images/cover.jpg"],
    ["//cdn.example.org/cover.jpg", "https://cdn.example.org/cover.jpg"],
    ["  https://cdn.example.org/a b.jpg ", "https://cdn.example.org/a%20b.jpg"],
  ])("makes %j absolute against the final URL", (value, absolute) => {
    const finalUrl = "https://www.example.org/news/story?id=1";

    expect(pageCandidates([["og:image", value]], finalUrl)).toEqual([absolute]);
  });

  it.each([
    ["a data: URL", "data:image/png;base64,iVBORw0KGgo="],
    ["a javascript: URL", "javascript:alert(1)"],
    ["an ftp: URL", "ftp://files.example.com/cover.jpg"],
    ["a file: URL", "file:///etc/passwd"],
    ["a blank value (it would name the page itself)", "   "],
    ["a value that isn't a URL", "https://exa mple.com/cover.jpg"],
  ])("drops %s and falls back to the next offer", (_case, value) => {
    const tags: [string, string][] = [
      ["og:image", value],
      ["twitter:image", "https://cdn.example.com/card.png"],
    ];

    expect(pageCandidates(tags)).toEqual(["https://cdn.example.com/card.png"]);
  });

  it("offers the same image once, even written differently", () => {
    const tags: [string, string][] = [
      ["og:image", "/cover.jpg"],
      ["twitter:image", "https://example.com/cover.jpg"],
    ];

    expect(pageCandidates(tags)).toEqual(["https://example.com/cover.jpg"]);
  });

  it("offers nothing for a page with no image tags", () => {
    expect(pageCandidates([["og:title", "A title"]])).toEqual([]);
  });

  it("offers an Image only its own final URL", () => {
    const finalUrl = "https://cdn.example.com/photos/sunset.png";

    expect(thumbnailCandidates({ finalUrl, isImage: true, head: null })).toEqual([finalUrl]);
  });

  it("offers nothing for an Item that isn't an Image and has no head", () => {
    expect(thumbnailCandidates({ finalUrl: PAGE_URL, isImage: false, head: null })).toEqual([]);
  });

  it("keeps an http: offer", () => {
    expect(pageCandidates([["og:image", "http://cdn.example.com/cover.jpg"]])).toEqual([
      "http://cdn.example.com/cover.jpg",
    ]);
  });
});
