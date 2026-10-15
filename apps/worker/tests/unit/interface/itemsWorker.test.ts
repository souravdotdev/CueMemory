import "reflect-metadata";
import { UnrecoverableError } from "bullmq";
import { Container } from "inversify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROCESS_ITEM_JOB } from "@cue-memory/shared/schemas/queue";
import type { ProcessItemResult } from "@/application/dto/items/ProcessItemResult";
import type { ProcessItemUseCase } from "@/application/use-cases/items/ProcessItemUseCase";
import { WORKER_TOKENS } from "@/di/tokens";
import { runItemsJob } from "@/interface/itemsWorker";

const ITEM_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

// A test container whose Process Item use case is a stand-in reporting `result`.
function testContainer(result: ProcessItemResult = { outcome: "ready", type: "video" }) {
  const useCase = { execute: vi.fn(async () => result) };
  const container = new Container();
  container
    .bind<Pick<ProcessItemUseCase, "execute">>(WORKER_TOKENS.ProcessItemUseCase)
    .toConstantValue(useCase);
  return { container, useCase };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Items queue's job switch", () => {
  it("runs a Process Item job's Processing with its Item and User", async () => {
    const { container, useCase } = testContainer();

    await runItemsJob(container, {
      name: PROCESS_ITEM_JOB,
      data: { itemId: ITEM_ID, userId: USER_ID },
    });

    expect(useCase.execute).toHaveBeenCalledWith({ itemId: ITEM_ID, userId: USER_ID });
  });

  it("drops keys a Process Item payload doesn't have", async () => {
    const { container, useCase } = testContainer();

    await runItemsJob(container, {
      name: PROCESS_ITEM_JOB,
      data: { itemId: ITEM_ID, userId: USER_ID, extra: true },
    });

    expect(useCase.execute).toHaveBeenCalledWith({ itemId: ITEM_ID, userId: USER_ID });
  });

  it.each([
    ["no payload", undefined],
    ["a missing userId", { itemId: ITEM_ID }],
    ["an itemId that isn't a UUID", { itemId: "42", userId: USER_ID }],
  ])("fails a Process Item job with %s without retrying it", async (_case, data) => {
    const { container, useCase } = testContainer();

    await expect(runItemsJob(container, { name: PROCESS_ITEM_JOB, data })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it("fails a job with an unknown name without retrying it", async () => {
    const { container, useCase } = testContainer();

    await expect(
      runItemsJob(container, { name: "send-digest", data: { itemId: ITEM_ID, userId: USER_ID } }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it("lets a Processing error through, so the job is retried", async () => {
    const { container, useCase } = testContainer();
    useCase.execute.mockRejectedValueOnce(new Error("Postgres is down"));

    const run = runItemsJob(container, {
      name: PROCESS_ITEM_JOB,
      data: { itemId: ITEM_ID, userId: USER_ID },
    });

    await expect(run).rejects.toThrow("Postgres is down");
    await expect(run).rejects.not.toBeInstanceOf(UnrecoverableError);
  });
});
