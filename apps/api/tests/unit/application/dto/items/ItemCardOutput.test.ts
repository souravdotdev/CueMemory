import { ItemCardSchema } from "@resonory/shared/schemas/items";
import { describe, expect, it } from "vitest";
import type { Item } from "@/domain/entities/Item";
import type { AppliedTag, Tag } from "@/domain/entities/Tag";
import type { IThumbnailUrlProvider } from "@/domain/providers/IThumbnailUrlProvider";
import { toItemCardOutput } from "@/application/dto/items/ItemCardOutput";

// A fake provider that makes it obvious which key each URL came from.
const thumbnails: IThumbnailUrlProvider = {
  resolve: async (key) => `https://cdn.example.com/signed/${key}?sig=fake`,
};

// A freshly saved Item that is still Processing; each test overrides only what it's about.
const item = (overrides: Partial<Item> = {}): Item => ({
  id: "item-1",
  userId: "user-1",
  sourceUrl: "https://example.com/post",
  type: null,
  status: "processing",
  title: null,
  description: null,
  thumbnailKey: null,
  extractedText: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  ...overrides,
});

const readyItem = item({
  type: "article",
  status: "ready",
  title: "How spaced repetition works",
  description: "A short primer on memory.",
  thumbnailKey: "thumbnails/user-1/item-1.jpg",
  extractedText: "Spaced repetition is a learning technique...",
});

// One of the User's Tags; each test overrides only what it's about.
const tag = (overrides: Partial<Tag> = {}): Tag => ({
  id: "tag-1",
  userId: "user-1",
  name: "memory",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  ...overrides,
});

const aiTag: AppliedTag = { tag: tag(), source: "ai" };
const userTag: AppliedTag = { tag: tag({ id: "tag-2", name: "learning" }), source: "user" };

describe("toItemCardOutput", () => {
  it("maps a Ready Item to its card with a resolved Thumbnail URL and an ISO created time", async () => {
    expect(await toItemCardOutput(readyItem, [], thumbnails)).toEqual({
      id: "item-1",
      sourceUrl: "https://example.com/post",
      type: "article",
      status: "ready",
      title: "How spaced repetition works",
      description: "A short primer on memory.",
      thumbnailUrl: "https://cdn.example.com/signed/thumbnails/user-1/item-1.jpg?sig=fake",
      failureMessage: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      tags: [],
    });
  });

  it("gives an Item with no Tags an empty Tag list", async () => {
    const card = await toItemCardOutput(item(), [], thumbnails);

    expect(card.tags).toEqual([]);
  });

  it("puts AI and User Tags on the card with who applied each", async () => {
    const card = await toItemCardOutput(readyItem, [aiTag, userTag], thumbnails);

    expect(card.tags).toEqual([
      { id: "tag-1", name: "memory", source: "ai" },
      { id: "tag-2", name: "learning", source: "user" },
    ]);
  });

  it("gives a null Thumbnail URL when the Item has no Thumbnail key", async () => {
    const card = await toItemCardOutput(item(), [], thumbnails);

    expect(card.thumbnailUrl).toBeNull();
  });

  it("needs no Thumbnail provider when the Item has no Thumbnail key", async () => {
    const card = await toItemCardOutput(item(), []);

    expect(card.thumbnailUrl).toBeNull();
  });

  // With Thumbnail storage unconfigured there's no provider: the card shows no Thumbnail.
  it("gives a null Thumbnail URL to an Item with a Thumbnail key when no Thumbnail provider is given", async () => {
    const card = await toItemCardOutput(readyItem, []);

    expect(card.thumbnailUrl).toBeNull();
  });

  it("gives a Failed Item the generic failure message", async () => {
    const card = await toItemCardOutput(item({ type: "link", status: "failed" }), [], thumbnails);

    expect(card.failureMessage).toBe("We couldn't process this link. Try again.");
  });

  it.each([item(), readyItem])("gives a null failure message to a $status Item", async (i) => {
    const card = await toItemCardOutput(i, [], thumbnails);

    expect(card.failureMessage).toBeNull();
  });

  it("leaves out every internal field", async () => {
    const failed = item({ type: "link", status: "failed" });

    for (const card of [
      await toItemCardOutput(readyItem, [aiTag], thumbnails),
      await toItemCardOutput(failed, [], thumbnails),
    ]) {
      for (const field of ["userId", "extractedText", "thumbnailKey", "updatedAt"]) {
        expect(card).not.toHaveProperty(field);
      }
      for (const cardTag of card.tags) {
        for (const field of ["userId", "createdAt", "updatedAt"]) {
          expect(cardTag).not.toHaveProperty(field);
        }
      }
    }
  });

  it("produces cards that parse with the card schema", async () => {
    const cases: [Item, AppliedTag[]][] = [
      [item(), []],
      [readyItem, [aiTag, userTag]],
      [item({ type: "link", status: "failed" }), [userTag]],
    ];

    for (const [i, tags] of cases) {
      const card = await toItemCardOutput(i, tags, thumbnails);

      expect(ItemCardSchema.parse(card)).toEqual(card);
    }
  });
});
