import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { FailItemUseCase } from "@/application/use-cases/items/FailItemUseCase";
import type { Item, ItemType } from "@/domain/entities/Item";
import type { IItemRepository } from "@/domain/repositories/IItemRepository";

const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OTHER_USER_ID = "0b6a1f7e-2c3d-4e5f-8a9b-1c2d3e4f5a6b";
const ITEM_ID = "00000000-0000-4000-8000-000000000001";

// An in-memory Item repository holding one Processing Item for USER_ID.
function itemsInMemory(type: ItemType | null = null) {
  const item: Item = {
    id: ITEM_ID,
    userId: USER_ID,
    sourceUrl: "https://example.com/a-post",
    type,
    status: "processing",
  };
  const owns = (itemId: string, userId: string) => itemId === item.id && userId === item.userId;
  const repository: IItemRepository = {
    findById: vi.fn(async (itemId: string, userId: string) =>
      owns(itemId, userId) ? { ...item } : null,
    ),
    markReady: vi.fn(async () => {}),
    markFailed: vi.fn(async (itemId: string, userId: string, failedType: ItemType) => {
      if (owns(itemId, userId)) {
        item.status = "failed";
        item.type = failedType;
      }
    }),
  };
  return { repository, item };
}

describe("FailItemUseCase", () => {
  it("marks an Item with no Item type Failed as a Link", async () => {
    const { repository, item } = itemsInMemory();
    const useCase = new FailItemUseCase(repository);

    const result = await useCase.execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(result).toEqual({ outcome: "failed", type: "link" });
    expect(item).toMatchObject({ status: "failed", type: "link" });
  });

  it("keeps the Item type an Item already has", async () => {
    const { repository, item } = itemsInMemory("video");
    const useCase = new FailItemUseCase(repository);

    const result = await useCase.execute({ itemId: ITEM_ID, userId: USER_ID });

    expect(result).toEqual({ outcome: "failed", type: "video" });
    expect(item).toMatchObject({ status: "failed", type: "video" });
  });

  it("does nothing for an Item that no longer exists", async () => {
    const { repository } = itemsInMemory();
    const useCase = new FailItemUseCase(repository);

    const result = await useCase.execute({
      itemId: "00000000-0000-4000-8000-000000000099",
      userId: USER_ID,
    });

    expect(result).toEqual({ outcome: "missing" });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("never touches another User's Item", async () => {
    const { repository, item } = itemsInMemory();
    const useCase = new FailItemUseCase(repository);

    const result = await useCase.execute({ itemId: ITEM_ID, userId: OTHER_USER_ID });

    expect(result).toEqual({ outcome: "missing" });
    expect(item).toMatchObject({ status: "processing", type: null });
  });
});
