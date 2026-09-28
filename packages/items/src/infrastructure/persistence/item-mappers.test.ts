import { describe, expect, it } from "vitest";
import { toCollection, toItem, toTag } from "./item-mappers";

describe("toItem", () => {
  it("converts the Drizzle Date createdAt into an ISO string", () => {
    const createdAt = new Date("2026-01-15T12:30:00.000Z");

    const item = toItem({
      id: "item-1",
      userId: "user-1",
      type: "article",
      sourceUrl: "https://example.com",
      status: "ready",
      title: "Example",
      thumbnailUrl: null,
      author: null,
      extractedText: null,
      createdAt,
    });

    expect(item.createdAt).toBe("2026-01-15T12:30:00.000Z");
    expect(typeof item.createdAt).toBe("string");
  });
});

describe("toTag", () => {
  it("converts the Drizzle Date createdAt into an ISO string", () => {
    const tag = toTag({
      id: "tag-1",
      name: "reading",
      isAiGenerated: true,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(tag.createdAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("toCollection", () => {
  it("converts the Drizzle Date createdAt into an ISO string", () => {
    const collection = toCollection({
      id: "collection-1",
      userId: "user-1",
      name: "Reading list",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(collection.createdAt).toBe("2026-03-01T00:00:00.000Z");
  });
});
