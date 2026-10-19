import { describe, expect, it } from "vitest";
import { itemTypeFromTwitterCard } from "@/domain/rules/itemTypeFromTwitterCard";
import { headWithMeta } from "../../../support/pageHead";

describe("itemTypeFromTwitterCard", () => {
  it.each([
    [{ "twitter:card": "player" }, "video"],
    [{ "twitter:card": "Player" }, "video"],
    [{ "twitter:card": "photo" }, "image"],
  ] as const)("types %o as %s", (tags, itemType) => {
    expect(itemTypeFromTwitterCard(headWithMeta(tags))).toBe(itemType);
  });

  it.each([
    [{}],
    [{ "twitter:card": "summary" }],
    [{ "twitter:card": "summary_large_image" }],
    [{ "twitter:card": "app" }],
  ])("returns null for %o", (tags) => {
    expect(itemTypeFromTwitterCard(headWithMeta(tags))).toBeNull();
  });
});
