import { describe, expect, it } from "vitest";
import { ItemCardSchema } from "./index";

const readyCard = {
  id: "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  sourceUrl: "https://example.com/article",
  type: "article",
  status: "ready",
  title: "How spaced repetition works",
  description: "A short primer on memory.",
  thumbnailUrl: "https://cdn.example.com/signed/thumb.jpg?sig=abc",
  failureMessage: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  tags: [
    { id: "tag-1", name: "memory", source: "ai" },
    { id: "tag-2", name: "learning", source: "user" },
  ],
};

describe("ItemCardSchema", () => {
  it("accepts a Ready Item's card", () => {
    expect(ItemCardSchema.parse(readyCard)).toEqual(readyCard);
  });

  it("accepts a Processing Item's card, with no type, title or Thumbnail yet", () => {
    const card = {
      ...readyCard,
      type: null,
      status: "processing",
      title: null,
      description: null,
      thumbnailUrl: null,
      tags: [],
    };

    expect(ItemCardSchema.parse(card)).toEqual(card);
  });

  it("accepts a Failed Item's card with its failure message", () => {
    const card = { ...readyCard, status: "failed", failureMessage: "We couldn't find that page." };

    expect(ItemCardSchema.parse(card)).toEqual(card);
  });

  it.each(["tweet", "video", "image", "pdf", "link"])("accepts the %s Item type", (type) => {
    expect(ItemCardSchema.safeParse({ ...readyCard, type }).success).toBe(true);
  });

  it("rejects an unknown Item type", () => {
    expect(ItemCardSchema.safeParse({ ...readyCard, type: "podcast" }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(ItemCardSchema.safeParse({ ...readyCard, status: "archived" }).success).toBe(false);
  });

  it("rejects a created time that isn't an ISO-8601 string", () => {
    expect(ItemCardSchema.safeParse({ ...readyCard, createdAt: "April 1st" }).success).toBe(false);
  });

  it("rejects a card without its tags list", () => {
    const { tags: _tags, ...card } = readyCard;

    expect(ItemCardSchema.safeParse(card).success).toBe(false);
  });

  it("rejects a Tag applied by anyone other than the AI or the User", () => {
    const tags = [{ id: "tag-1", name: "memory", source: "import" }];

    expect(ItemCardSchema.safeParse({ ...readyCard, tags }).success).toBe(false);
  });

  it("strips fields the card doesn't declare", () => {
    const parsed = ItemCardSchema.parse({
      ...readyCard,
      userId: "user-1",
      extractedText: "Spaced repetition is...",
      thumbnailKey: "thumbnails/user-1/item-1.jpg",
    });

    expect(parsed).toEqual(readyCard);
  });
});
