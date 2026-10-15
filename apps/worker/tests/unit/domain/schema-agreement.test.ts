import { itemStatusEnum, itemTypeEnum } from "@cue-memory/db/schema";
import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, ITEM_TYPES } from "@/domain/entities/Item";

// The database package owns the tables and the worker's domain can't import it;
// this keeps the worker's copy of the Item types and statuses from drifting.
describe("the items table agrees with the worker's Items domain", () => {
  it("stores exactly the domain's Item types and Item statuses", () => {
    expect(itemTypeEnum.enumValues).toEqual(ITEM_TYPES);
    expect(itemStatusEnum.enumValues).toEqual(ITEM_STATUSES);
  });
});
