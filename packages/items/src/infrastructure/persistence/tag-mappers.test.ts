import { describe, expect, it } from "vitest";
import { toTag, toTagLink } from "./tag-mappers";

type TagRow = Parameters<typeof toTag>[0];
type TagLinkRow = Parameters<typeof toTagLink>[0];

// A User's Tag; each test overrides only what it's about.
const tagRow = (overrides: Partial<TagRow> = {}): TagRow => ({
  id: "tag-1",
  userId: "user-1",
  name: "machine-learning",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  ...overrides,
});

// An AI-applied link between one of the User's Items and one of their Tags.
const tagLinkRow = (overrides: Partial<TagLinkRow> = {}): TagLinkRow => ({
  itemId: "item-1",
  tagId: "tag-1",
  userId: "user-1",
  source: "ai",
  createdAt: new Date("2026-04-03T00:00:00.000Z"),
  ...overrides,
});

describe("toTag", () => {
  it("maps a Tag with its canonical name and date timestamps", () => {
    expect(toTag(tagRow())).toEqual({
      id: "tag-1",
      userId: "user-1",
      name: "machine-learning",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    });
  });
});

describe("toTagLink", () => {
  it("maps an AI-applied link to the Item, the Tag and who applied it", () => {
    expect(toTagLink(tagLinkRow())).toEqual({ itemId: "item-1", tagId: "tag-1", source: "ai" });
  });

  it("maps a User-applied link", () => {
    expect(toTagLink(tagLinkRow({ source: "user" }))).toEqual({
      itemId: "item-1",
      tagId: "tag-1",
      source: "user",
    });
  });
});
