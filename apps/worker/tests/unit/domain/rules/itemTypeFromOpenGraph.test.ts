import { describe, expect, it } from "vitest";
import { itemTypeFromOpenGraph } from "@/domain/rules/itemTypeFromOpenGraph";
import { headWithMeta } from "../../../support/pageHead";

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
    expect(itemTypeFromOpenGraph(headWithMeta(tags))).toBe(itemType);
  });

  it.each([
    [{}],
    [{ "og:type": "website" }],
    [{ "og:type": "profile" }],
    [{ "og:type": "book" }],
    [{ "og:video": "" }],
    [{ "twitter:card": "player" }],
  ])("returns null for %o", (tags) => {
    expect(itemTypeFromOpenGraph(headWithMeta(tags))).toBeNull();
  });
});
