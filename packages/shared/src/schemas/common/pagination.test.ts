import { z } from "zod";
import { describe, expect, it } from "vitest";
import { paginated } from "./index";

const pageOfNames = paginated(z.object({ name: z.string() }));

describe("paginated", () => {
  it("accepts a page of items with an opaque next cursor", () => {
    const page = { items: [{ name: "a" }, { name: "b" }], nextCursor: "eyJpZCI6ImIifQ" };

    expect(pageOfNames.parse(page)).toEqual(page);
  });

  it("accepts the last page, whose next cursor is null", () => {
    const page = { items: [], nextCursor: null };

    expect(pageOfNames.parse(page)).toEqual(page);
  });

  it("rejects a page whose items break the item schema", () => {
    expect(pageOfNames.safeParse({ items: [{ name: 1 }], nextCursor: null }).success).toBe(false);
  });

  it("rejects a page without a next cursor", () => {
    expect(pageOfNames.safeParse({ items: [] }).success).toBe(false);
  });
});
