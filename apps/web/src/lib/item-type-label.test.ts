import { ItemTypeSchema } from "@cue-memory/shared/schemas/items";
import { describe, expect, it } from "vitest";
import { itemTypeLabel } from "./item-type-label";

describe("itemTypeLabel", () => {
  it.each([
    ["article", "Article"],
    ["post", "Post"],
    ["video", "Video"],
    ["image", "Image"],
    ["audio", "Audio"],
    ["pdf", "PDF"],
    ["code", "Code"],
    ["file", "File"],
    ["link", "Link"],
  ] as const)("labels %s as %s", (type, label) => {
    expect(itemTypeLabel(type)).toBe(label);
  });

  it("labels every Item type", () => {
    for (const type of ItemTypeSchema.options) {
      expect(itemTypeLabel(type)).toBeTruthy();
    }
  });

  it("shows nothing while the Item has no type yet", () => {
    expect(itemTypeLabel(null)).toBeNull();
  });
});
