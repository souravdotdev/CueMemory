import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createItem, fetchItems } from "./api";

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

const taggedCard = {
  ...card,
  type: "article",
  status: "ready",
  title: "How spaced repetition works",
  tags: [
    { id: "tag-1", name: "memory", source: "ai" },
    { id: "tag-2", name: "learning", source: "user" },
  ],
};

const fetchMock = vi.fn<typeof fetch>();

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchItems", () => {
  it("returns the page of Item cards and its next cursor", async () => {
    respond(200, { items: [card], nextCursor: "eyJpZCI6Iml0ZW0tMSJ9" });

    expect(await fetchItems()).toEqual({ items: [card], nextCursor: "eyJpZCI6Iml0ZW0tMSJ9" });
  });

  it("returns each card's tags with who applied them", async () => {
    respond(200, { items: [taggedCard], nextCursor: null });

    expect((await fetchItems()).items[0]?.tags).toEqual([
      { id: "tag-1", name: "memory", source: "ai" },
      { id: "tag-2", name: "learning", source: "user" },
    ]);
  });

  it("throws when a card's tag has an unknown source", async () => {
    const tags = [{ id: "tag-1", name: "memory", source: "import" }];
    respond(200, { items: [{ ...card, tags }], nextCursor: null });

    await expect(fetchItems()).rejects.toThrow();
  });

  it("drops fields the card contract doesn't declare", async () => {
    respond(200, { items: [{ ...card, userId: "user-1" }], nextCursor: null });

    const page = await fetchItems();

    expect(page.items[0]).not.toHaveProperty("userId");
  });

  it("throws when the response breaks the list contract", async () => {
    respond(200, [card]);

    await expect(fetchItems()).rejects.toThrow();
  });

  it("throws the error envelope's message when the request fails", async () => {
    respond(401, { error: { code: "unauthorized", message: "Sign in to see your Items" } });

    await expect(fetchItems()).rejects.toThrow("Sign in to see your Items");
  });
});

describe("createItem", () => {
  it("posts the link and returns the new Item's card", async () => {
    respond(201, card);

    expect(await createItem("https://example.com/article")).toEqual(card);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ url: "https://example.com/article" });
  });

  it("throws when the saved Item breaks the card contract", async () => {
    respond(201, { ...card, status: "archived" });

    await expect(createItem("https://example.com/article")).rejects.toThrow();
  });

  it("throws the error envelope's message when saving fails", async () => {
    respond(400, {
      error: { code: "validation_failed", message: "Enter a valid http(s) link", details: [] },
    });

    await expect(createItem("ftp://example.com")).rejects.toThrow("Enter a valid http(s) link");
  });

  it("throws a generic message when a failure has no error envelope", async () => {
    fetchMock.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));

    await expect(createItem("https://example.com/article")).rejects.toThrow("Failed to save item");
  });
});
