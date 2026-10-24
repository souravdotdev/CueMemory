import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { PROCESS_ITEM_JOB } from "@resonory/shared/schemas/queue";
import { BullMqQueueProvider, type ItemsQueue } from "@/infrastructure/queue/BullMqQueueProvider";

const job = {
  itemId: "3b241101-e2bb-4255-8caf-4136c566a962",
  userId: "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
};

const queueRecording = () => ({ add: vi.fn(async () => ({})) }) satisfies ItemsQueue;

describe("BullMqQueueProvider", () => {
  it("adds a Process Item job with the Item's and User's ids", async () => {
    const queue = queueRecording();

    await new BullMqQueueProvider(queue).enqueueProcessItem(job);

    expect(queue.add).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledWith(PROCESS_ITEM_JOB, job, expect.anything());
  });

  it("retries 3 times with exponential backoff from 5 s, keeping the last 1000 done and 5000 failed jobs", async () => {
    const queue = queueRecording();

    await new BullMqQueueProvider(queue).enqueueProcessItem(job);

    expect(queue.add).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  });

  it("refuses a payload the worker couldn't read, without adding it", async () => {
    const queue = queueRecording();

    await expect(
      new BullMqQueueProvider(queue).enqueueProcessItem({ ...job, itemId: "item-1" }),
    ).rejects.toThrow();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
