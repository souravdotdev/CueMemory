import { describe, expect, it } from "vitest";
import { toTag } from "./item-mappers";

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
