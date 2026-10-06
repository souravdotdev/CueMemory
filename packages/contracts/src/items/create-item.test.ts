import { describe, expect, it } from "vitest";
import { createItemRequestDtoSchema } from "./index";

describe("createItemRequestDtoSchema", () => {
  it.each(["https://example.com/article", "http://example.com/article"])("accepts %s", (url) => {
    expect(createItemRequestDtoSchema.parse({ url })).toEqual({ url });
  });

  it("trims leading and trailing spaces from the link", () => {
    expect(createItemRequestDtoSchema.parse({ url: "  https://example.com/a  " })).toEqual({
      url: "https://example.com/a",
    });
  });

  it.each(["ftp://example.com/file", "javascript:alert(1)", "mailto:me@example.com"])(
    "rejects the non-http(s) link %s",
    (url) => {
      expect(createItemRequestDtoSchema.safeParse({ url }).success).toBe(false);
    },
  );

  it.each(["not a url", "", "https://"])("rejects the malformed link %j", (url) => {
    expect(createItemRequestDtoSchema.safeParse({ url }).success).toBe(false);
  });

  it("accepts a link of exactly 2048 characters and rejects one of 2049", () => {
    const base = "https://example.com/";
    const atLimit = base + "a".repeat(2048 - base.length);

    expect(createItemRequestDtoSchema.safeParse({ url: atLimit }).success).toBe(true);
    expect(createItemRequestDtoSchema.safeParse({ url: atLimit + "a" }).success).toBe(false);
  });
});
