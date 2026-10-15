import { describe, expect, it } from "vitest";
import { itemTypeFromUrl } from "@/domain/rules/itemTypeFromUrl";

describe("itemTypeFromUrl", () => {
  it.each([
    // X or Twitter: /<user>/status/<id>
    ["https://x.com/jack/status/20", "post"],
    ["https://twitter.com/jack/status/20", "post"],
    ["https://www.twitter.com/jack/status/20?s=20", "post"],
    ["https://m.twitter.com/jack/status/20", "post"],
    ["https://x.com/jack/status/20/photo/1", "post"],
    // YouTube: /watch, /shorts/, /live/ and youtu.be
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "video"],
    ["https://youtube.com/shorts/abc123", "video"],
    ["https://www.youtube.com/live/abc123", "video"],
    ["https://youtu.be/dQw4w9WgXcQ", "video"],
    ["https://youtu.be/dQw4w9WgXcQ?si=xyz", "video"],
    // Instagram: /reel/ or /reels/ is a Video, /p/ an Image
    ["https://www.instagram.com/reel/C1a2b3/", "video"],
    ["https://instagram.com/reels/C1a2b3/", "video"],
    ["https://www.instagram.com/p/C1a2b3/?igsh=abc", "image"],
    // Reddit: /r/<sub>/comments/… and redd.it
    ["https://www.reddit.com/r/typescript/comments/abc123/some_title/", "article"],
    ["https://m.reddit.com/r/typescript/comments/abc123", "article"],
    ["https://redd.it/abc123", "article"],
    // A path ending .pdf, any case
    ["https://arxiv.org/pdf/1706.03762v7.pdf", "pdf"],
    ["https://example.com/papers/Report.PDF", "pdf"],
    ["https://example.com/paper.pdf?download=1#page=2", "pdf"],
    // A path ending in an image extension, any case
    ["https://example.com/a.png", "image"],
    ["https://example.com/a.jpg", "image"],
    ["https://example.com/a.JPEG", "image"],
    ["https://example.com/a.gif", "image"],
    ["https://example.com/a.webp", "image"],
    ["https://example.com/a.Svg", "image"],
    ["https://example.com/a.avif?w=200", "image"],
  ] as const)("%s → %s", (url, type) => {
    expect(itemTypeFromUrl(url)).toBe(type);
  });

  it.each([
    // An X profile, a home timeline and a search aren't Posts
    "https://x.com/jack",
    "https://www.twitter.com/jack/likes",
    "https://x.com/search?q=status",
    // YouTube pages that aren't one video
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/watchlater",
    "https://youtu.be/",
    // An Instagram profile and a Reddit subreddit
    "https://www.instagram.com/someone/",
    "https://www.reddit.com/r/typescript/",
    // The extension has to end the path, not sit in the query or mid-path
    "https://example.com/view?file=report.pdf",
    "https://example.com/report.pdf/preview",
    "https://example.com/logo.pngx",
    // Anything else
    "https://example.com/blog/a-post",
    "https://news.ycombinator.com/item?id=1",
  ])("%s → no rule", (url) => {
    expect(itemTypeFromUrl(url)).toBeNull();
  });

  it("compares hosts without their case", () => {
    expect(itemTypeFromUrl("https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ")).toBe("video");
  });

  it("applies the first matching rule: a YouTube video wins over an extension", () => {
    expect(itemTypeFromUrl("https://youtube.com/shorts/clip.png")).toBe("video");
  });

  it("matches no rule for a string that isn't a URL", () => {
    expect(itemTypeFromUrl("not a url")).toBeNull();
  });
});
