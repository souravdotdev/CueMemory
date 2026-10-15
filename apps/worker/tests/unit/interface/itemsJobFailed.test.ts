import "reflect-metadata";
import { UnrecoverableError } from "bullmq";
import { Container } from "inversify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROCESS_ITEM_JOB } from "@cue-memory/shared/schemas/queue";
import type { FailItemUseCase } from "@/application/use-cases/items/FailItemUseCase";
import { WORKER_TOKENS } from "@/di/tokens";
import { type FailedItemsJob, onItemsJobFailed } from "@/interface/itemsJobFailed";

const ITEM_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

// A test container whose Fail Item use case is a stand-in marking the Item Failed as a Link.
function testContainer() {
  const useCase = {
    execute: vi.fn(async () => ({ outcome: "failed" as const, type: "link" as const })),
  };
  const container = new Container();
  container
    .bind<Pick<FailItemUseCase, "execute">>(WORKER_TOKENS.FailItemUseCase)
    .toConstantValue(useCase);
  return { container, useCase };
}

// A Process Item job after `attemptsMade` failed attempts out of 3.
function processItemJob(
  attemptsMade: number,
  data: unknown = { itemId: ITEM_ID, userId: USER_ID },
) {
  return {
    id: "42",
    name: PROCESS_ITEM_JOB,
    data,
    attemptsMade,
    opts: { attempts: 3 },
  } satisfies FailedItemsJob;
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a failed job on the Items queue", () => {
  it("marks the Item Failed after the final attempt", async () => {
    const { container, useCase } = testContainer();

    await onItemsJobFailed(container, processItemJob(3), new Error("Postgres is down"));

    expect(useCase.execute).toHaveBeenCalledWith({ itemId: ITEM_ID, userId: USER_ID });
  });

  it.each([1, 2])("leaves the Item Processing after attempt %i of 3", async (attemptsMade) => {
    const { container, useCase } = testContainer();

    await onItemsJobFailed(container, processItemJob(attemptsMade), new Error("Postgres is down"));

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it("logs why the job failed, on every attempt", async () => {
    const { container } = testContainer();

    await onItemsJobFailed(container, processItemJob(1), new Error("Postgres is down"));
    await onItemsJobFailed(container, processItemJob(3), new Error("fetch timed out"));

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Postgres is down"));
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("fetch timed out"));
  });

  it("changes no Item when the job could never succeed (invalid payload)", async () => {
    const { container, useCase } = testContainer();

    await onItemsJobFailed(
      container,
      processItemJob(1, { itemId: "42" }),
      new UnrecoverableError("Invalid Process Item payload"),
    );

    expect(useCase.execute).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Invalid Process Item payload"));
  });

  it("changes no Item for a job with an unknown name", async () => {
    const { container, useCase } = testContainer();

    await onItemsJobFailed(
      container,
      { ...processItemJob(3), name: "send-digest" },
      new Error("boom"),
    );

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it("logs, rather than throws, when the Item can't be marked Failed", async () => {
    const { container, useCase } = testContainer();
    useCase.execute.mockRejectedValueOnce(new Error("Postgres is still down"));

    await expect(
      onItemsJobFailed(container, processItemJob(3), new Error("Postgres is down")),
    ).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Postgres is still down"));
  });

  it("logs a failure BullMQ reports without its job", async () => {
    const { container, useCase } = testContainer();

    await onItemsJobFailed(
      container,
      undefined,
      new Error("job stalled more than allowable limit"),
    );

    expect(useCase.execute).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("job stalled"));
  });
});
