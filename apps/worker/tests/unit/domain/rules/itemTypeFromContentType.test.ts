import { describe, expect, it } from "vitest";
import { itemTypeFromContentType } from "@/domain/rules/itemTypeFromContentType";

describe("itemTypeFromContentType", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["Application/PDF; qs=0.001", "pdf"],
    ["application/x-pdf", "pdf"],
    ["image/png", "image"],
    ["image/svg+xml", "image"],
    ["audio/mpeg", "audio"],
    ["audio/ogg; codecs=opus", "audio"],
    ["application/ogg", "audio"],
    ["video/mp4", "video"],
    ["video/quicktime", "video"],
    ["application/zip", "file"],
    ["application/x-zip-compressed", "file"],
    ["application/gzip", "file"],
    ["application/x-tar", "file"],
    ["application/x-7z-compressed", "file"],
    ["application/vnd.rar", "file"],
    ["application/msword", "file"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "file"],
    ["application/vnd.ms-excel", "file"],
    ["application/vnd.ms-powerpoint", "file"],
    ["application/vnd.oasis.opendocument.text", "file"],
    ["application/epub+zip", "file"],
    ["application/x-apple-diskimage", "file"],
    ["application/vnd.android.package-archive", "file"],
  ] as const)("types %s as %s", (contentType, type) => {
    expect(itemTypeFromContentType(contentType)).toBe(type);
  });

  it.each([
    ["text/html; charset=utf-8"],
    ["application/xhtml+xml"],
    ["application/json"],
    ["text/plain"],
    ["application/octet-stream"],
    [""],
    [null],
  ])("says nothing about %s", (contentType) => {
    expect(itemTypeFromContentType(contentType)).toBeNull();
  });
});
