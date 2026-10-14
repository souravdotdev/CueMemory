import { describe, expect, it } from "vitest";
import { CreateItemResponseSchema } from "./index";

describe("CreateItemResponseSchema", () => {
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

    expect(CreateItemResponseSchema.parse(card)).toEqual(card);
  });

  it("rejects a body that isn't an Item card", () => {
    expect(CreateItemResponseSchema.safeParse({ id: "item-1" }).success).toBe(false);
  });
});
