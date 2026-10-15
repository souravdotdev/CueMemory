import { describe, expect, it } from "vitest";
import { ITEMS_QUEUE, PROCESS_ITEM_JOB, ProcessItemJobSchema } from "./index";

const job = {
  itemId: "3b241101-e2bb-4255-8caf-4136c566a962",
  userId: "7f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
};

describe("the Items queue", () => {
  it("is named items, and its Processing job process-item", () => {
    expect(ITEMS_QUEUE).toBe("items");
    expect(PROCESS_ITEM_JOB).toBe("process-item");
  });
});

describe("ProcessItemJobSchema", () => {
  it("accepts the Item's id and its User's id", () => {
    expect(ProcessItemJobSchema.parse(job)).toEqual(job);
  });

  it.each(["itemId", "userId"] as const)("refuses a %s that isn't a UUID", (field) => {
    expect(ProcessItemJobSchema.safeParse({ ...job, [field]: "item-1" }).success).toBe(false);
  });

  it.each(["itemId", "userId"] as const)("refuses a job without %s", (field) => {
    const { [field]: _missing, ...rest } = job;

    expect(ProcessItemJobSchema.safeParse(rest).success).toBe(false);
  });

  it("drops fields the payload doesn't declare", () => {
    expect(ProcessItemJobSchema.parse({ ...job, sourceUrl: "https://example.com" })).toEqual(job);
  });
});
