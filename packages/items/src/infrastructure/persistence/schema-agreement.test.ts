import { itemStatusEnum, itemTypeEnum, tagSourceEnum, tagNameRule } from "@cue-memory/db/schema";
import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, ITEM_TYPES } from "../../domain/item";
import { TAG_SOURCES } from "../../domain/tag";
import { MAX_TAG_NAME_LENGTH, TAG_NAME_PATTERN } from "../../domain/tag-name";

// The database package owns the tables, so it can't import these rules from the
// Items domain; this keeps the two copies from drifting apart.
describe("Items tables agree with the Items domain", () => {
  it("stores exactly the domain's Item types, Item statuses and Tag sources", () => {
    expect(itemTypeEnum.enumValues).toEqual(ITEM_TYPES);
    expect(itemStatusEnum.enumValues).toEqual(ITEM_STATUSES);
    expect(tagSourceEnum.enumValues).toEqual(TAG_SOURCES);
  });

  it("checks Tag names with the domain's slug pattern and length limit", () => {
    expect(tagNameRule).toEqual({ pattern: TAG_NAME_PATTERN, maxLength: MAX_TAG_NAME_LENGTH });
  });
});
