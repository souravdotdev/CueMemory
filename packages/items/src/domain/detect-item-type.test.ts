import { describe, expect, it } from "vitest";
import { detectItemType } from "./detect-item-type";

describe("detectItemType", () => {
  it.each([
    ["https://x.com/someone/status/123", "tweet"],
    ["https://twitter.com/someone/status/123", "tweet"],
    ["https://www.twitter.com/someone/status/123", "tweet"],
    ["https://youtube.com/watch?v=abc123", "video"],
    ["https://youtu.be/abc123", "video"],
    ["https://www.youtube.com/watch?v=abc123", "video"],
    ["https://example.com/whitepaper.pdf", "pdf"],
    ["https://example.com/WHITEPAPER.PDF", "pdf"],
    ["https://example.com/photo.png", "image"],
    ["https://example.com/photo.jpg", "image"],
    ["https://example.com/photo.jpeg", "image"],
    ["https://example.com/photo.gif", "image"],
    ["https://example.com/photo.webp", "image"],
    ["https://example.com/photo.svg", "image"],
    ["https://example.com/some-article", "article"],
    ["https://news.example.com/2026/09/story", "article"],
  ] as const)("classifies %s as %s", (url, expected) => {
    expect(detectItemType(url)).toBe(expected);
  });
});
