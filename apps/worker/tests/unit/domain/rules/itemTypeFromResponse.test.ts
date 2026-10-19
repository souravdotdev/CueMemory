import { describe, expect, it } from "vitest";
import type { FetchedFile } from "@/domain/providers/IUrlFetcher";
import { itemTypeFromResponse } from "@/domain/rules/itemTypeFromResponse";

const PDF_BYTES = Uint8Array.from(Buffer.from("%PDF-1.7\n"));
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const file = (fields: Partial<FetchedFile>): FetchedFile => ({
  kind: "file",
  finalUrl: "https://example.com/download",
  contentType: null,
  firstBytes: new Uint8Array(),
  ...fields,
});

describe("itemTypeFromResponse", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["image/png", "image"],
    ["audio/mpeg", "audio"],
    ["video/mp4", "video"],
    ["application/zip", "file"],
    ["application/json", null],
    ["text/plain", null],
  ] as const)("types a %s response as %s", (contentType, type) => {
    expect(itemTypeFromResponse(file({ contentType }))).toBe(type);
  });

  it("trusts a specific Content-Type over the bytes", () => {
    expect(itemTypeFromResponse(file({ contentType: "video/mp4", firstBytes: PDF_BYTES }))).toBe(
      "video",
    );
  });

  it.each([
    ["application/octet-stream", PDF_BYTES, "pdf"],
    ["binary/octet-stream", PNG_BYTES, "image"],
    [null, PNG_BYTES, "image"],
    ["application/octet-stream", Uint8Array.from(Buffer.from("just text")), null],
  ] as const)("sniffs the bytes of a %s response", (contentType, firstBytes, type) => {
    expect(itemTypeFromResponse(file({ contentType, firstBytes }))).toBe(type);
  });

  it("doesn't sniff the bytes of a response that names another type", () => {
    expect(
      itemTypeFromResponse(file({ contentType: "text/plain", firstBytes: PDF_BYTES })),
    ).toBeNull();
  });

  it("says nothing about a response with nothing to go on", () => {
    expect(itemTypeFromResponse(file({}))).toBeNull();
  });
});
