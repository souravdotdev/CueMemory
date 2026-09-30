import { describe, expect, it } from "vitest";
import { toItem } from "./item-mappers";

type ItemRow = Parameters<typeof toItem>[0];

// A freshly saved Item that is still Processing; each test overrides only what it's about.
const row = (overrides: Partial<ItemRow> = {}): ItemRow => ({
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

// What a Processing row maps to; each test spreads it and overrides only what it's about.
const processingItem = {
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
};

describe("toItem", () => {
  it("maps a Processing Item with every processing field null and date timestamps", () => {
    expect(toItem(row())).toEqual(processingItem);
  });

  it("maps a Ready Item with every field, passing the Thumbnail key through as-is", () => {
    const item = toItem(
      row({
        type: "article",
        status: "ready",
        title: "How spaced repetition works",
        description: "A short primer on memory.",
        thumbnailKey: "thumbnails/user-1/item-1.jpg",
        extractedText: "Spaced repetition is a learning technique...",
      }),
    );

    expect(item).toEqual({
      ...processingItem,
      type: "article",
      status: "ready",
      title: "How spaced repetition works",
      description: "A short primer on memory.",
      thumbnailKey: "thumbnails/user-1/item-1.jpg",
      extractedText: "Spaced repetition is a learning technique...",
    });
  });

  it("maps a Failed Item", () => {
    const item = toItem(row({ type: "link", status: "failed" }));

    expect(item).toEqual({ ...processingItem, type: "link", status: "failed" });
  });
});
