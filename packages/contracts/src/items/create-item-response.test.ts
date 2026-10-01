import { describe, expect, it } from "vitest";
import { createItemResponseDtoSchema } from "./index";

describe("createItemResponseDtoSchema", () => {
  it("is the new Item's card, still Processing", () => {
    const card = {
      id: "item-1",
      sourceUrl: "https://example.com/article",
      type: null,
      status: "processing",
      title: null,
      description: null,
      thumbnailUrl: null,
      failureMessage: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      tags: [],
    };

    expect(createItemResponseDtoSchema.parse(card)).toEqual(card);
  });

  it("rejects a body that isn't an Item card", () => {
    expect(createItemResponseDtoSchema.safeParse({ id: "item-1" }).success).toBe(false);
  });
});
