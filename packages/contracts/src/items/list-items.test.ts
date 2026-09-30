import { describe, expect, it } from "vitest";
import { listItemsQueryDtoSchema, listItemsResponseDtoSchema } from "./index";

describe("listItemsQueryDtoSchema", () => {
  it("defaults the limit to 30 when nothing is given", () => {
    expect(listItemsQueryDtoSchema.parse({})).toEqual({ limit: 30 });
  });

  it("accepts a keyword, tag id, cursor and limit together", () => {
    const query = {
      q: "memory",
      tagId: "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      cursor: "eyJpZCI6ImIifQ",
      limit: 50,
    };

    expect(listItemsQueryDtoSchema.parse(query)).toEqual(query);
  });

  it("reads a limit sent as a query-string value", () => {
    expect(listItemsQueryDtoSchema.parse({ limit: "10" })).toEqual({ limit: 10 });
  });

  it.each([1, 100])("accepts the boundary limit %d", (limit) => {
    expect(listItemsQueryDtoSchema.parse({ limit })).toEqual({ limit });
  });

  it.each([0, 101, -5, 2.5])("rejects the limit %d", (limit) => {
    expect(listItemsQueryDtoSchema.safeParse({ limit }).success).toBe(false);
  });

  it("rejects a tag id that isn't a uuid", () => {
    expect(listItemsQueryDtoSchema.safeParse({ tagId: "tag-1" }).success).toBe(false);
  });
});

describe("listItemsResponseDtoSchema", () => {
  const card = {
    id: "item-1",
    sourceUrl: "https://example.com/article",
    type: "article",
    status: "ready",
    title: "A title",
    description: null,
    thumbnailUrl: null,
    failureMessage: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  it("accepts a page of Item cards with a next cursor", () => {
    const page = { items: [card], nextCursor: "eyJpZCI6Iml0ZW0tMSJ9" };

    expect(listItemsResponseDtoSchema.parse(page)).toEqual(page);
  });

  it("rejects a page containing something that isn't an Item card", () => {
    expect(
      listItemsResponseDtoSchema.safeParse({ items: [{ id: "item-1" }], nextCursor: null }).success,
    ).toBe(false);
  });
});
