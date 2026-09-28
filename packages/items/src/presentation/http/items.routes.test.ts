import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { Item } from "@second-brain/types";
import type { ItemQueue } from "../../domain/ports/item-queue";
import type { ItemRepository } from "../../domain/ports/item-repository";
import { itemRoutes } from "./items.routes";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    userId: "user-1",
    type: "article",
    sourceUrl: "https://example.com/some-article",
    status: "processing",
    title: null,
    thumbnailUrl: null,
    author: null,
    extractedText: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildApp() {
  const itemRepository: ItemRepository = {
    create: vi.fn().mockResolvedValue(makeItem()),
    findAllByUser: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn(),
  };
  const itemQueue: ItemQueue = { enqueueProcessing: vi.fn().mockResolvedValue(undefined) };

  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(itemRoutes({ itemRepository, itemQueue }));

  return { app, itemRepository, itemQueue };
}

describe("POST /items", () => {
  it("returns 401 when x-user-id is missing", async () => {
    const { app } = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/items",
      payload: { url: "https://example.com" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for an invalid URL", async () => {
    const { app } = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/items",
      headers: { "x-user-id": "user-1" },
      payload: { url: "not-a-url" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("creates the item and enqueues processing on a valid request", async () => {
    const { app, itemRepository, itemQueue } = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/items",
      headers: { "x-user-id": "user-1" },
      payload: { url: "https://example.com/some-article" },
    });

    expect(res.statusCode).toBe(201);
    expect(itemRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", sourceUrl: "https://example.com/some-article" }),
    );
    expect(itemQueue.enqueueProcessing).toHaveBeenCalledTimes(1);
    expect(res.json()).toMatchObject({ collectionId: null });
  });
});

describe("GET /items", () => {
  let app: ReturnType<typeof buildApp>["app"];
  let itemRepository: ItemRepository;

  beforeEach(() => {
    ({ app, itemRepository } = buildApp());
  });

  it("returns an empty array when x-user-id is missing, without touching the repository", async () => {
    const res = await app.inject({ method: "GET", url: "/items" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(itemRepository.findAllByUser).not.toHaveBeenCalled();
  });

  it("delegates to the repository for the given user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/items",
      headers: { "x-user-id": "user-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(itemRepository.findAllByUser).toHaveBeenCalledWith("user-1");
  });
});
