import { describe, expect, it } from "vitest";
import { itemTypeFromMagicBytes } from "@/domain/rules/itemTypeFromMagicBytes";

// The first bytes of a file: hex pairs and quoted ASCII, e.g. `89 "PNG" 0d 0a`.
function bytes(spec: string): Uint8Array {
  const out: number[] = [];
  for (const [, ascii, hex] of spec.matchAll(/"([^"]*)"|([0-9a-f]{2})/gi)) {
    if (ascii !== undefined) out.push(...Buffer.from(ascii, "latin1"));
    else out.push(Number.parseInt(hex!, 16));
  }
  return Uint8Array.from(out);
}

describe("itemTypeFromMagicBytes", () => {
  it.each([
    ["PDF", `"%PDF-1.7" 0a 25 e2 e3`, "pdf"],
    ["PNG", `89 "PNG" 0d 0a 1a 0a 00 00 00 0d "IHDR"`, "image"],
    ["JPEG", `ff d8 ff e0 00 10 "JFIF" 00`, "image"],
    ["GIF87a", `"GIF87a" 01 00 01 00`, "image"],
    ["GIF89a", `"GIF89a" 01 00 01 00`, "image"],
    ["WebP", `"RIFF" 24 00 00 00 "WEBPVP8 "`, "image"],
    ["AVIF", `00 00 00 1c "ftypavif" 00 00 00 00`, "image"],
    ["HEIC", `00 00 00 18 "ftypheic" 00 00 00 00`, "image"],
    ["TIFF (little-endian)", `"II" 2a 00 08 00 00 00`, "image"],
    ["ZIP", `"PK" 03 04 14 00 00 00 08 00`, "file"],
    ["empty ZIP", `"PK" 05 06 00 00 00 00`, "file"],
    ["gzip", `1f 8b 08 00 00 00 00 00`, "file"],
    ["7z", `"7z" bc af 27 1c 00 04`, "file"],
    ["RAR", `"Rar!" 1a 07 01 00`, "file"],
    ["MP3 with ID3", `"ID3" 04 00 00 00 00 00 23`, "audio"],
    ["MP3 frame", `ff fb 90 64 00 00 00 00`, "audio"],
    ["M4A", `00 00 00 20 "ftypM4A " 00 00 00 00`, "audio"],
    ["OGG", `"OggS" 00 02 00 00 00 00 00 00`, "audio"],
    ["WAV", `"RIFF" 24 08 00 00 "WAVEfmt "`, "audio"],
    ["FLAC", `"fLaC" 00 00 00 22`, "audio"],
    ["MP4", `00 00 00 18 "ftypmp42" 00 00 00 00`, "video"],
    ["MP4 (isom)", `00 00 00 20 "ftypisom" 00 00 02 00`, "video"],
    ["MOV", `00 00 00 14 "ftypqt  " 00 00 00 00`, "video"],
    ["WebM/MKV", `1a 45 df a3 9f 42 86 81 01`, "video"],
    ["AVI", `"RIFF" 24 08 00 00 "AVI LIST"`, "video"],
  ] as const)("types a %s as %s", (_name, spec, type) => {
    expect(itemTypeFromMagicBytes(bytes(spec))).toBe(type);
  });

  it.each([
    ["HTML", `"<!doctype html>"`],
    ["plain text", `"hello, world"`],
    ["a truncated PNG signature", `89 "PN"`],
    ["a RIFF of another kind", `"RIFF" 24 08 00 00 "CDXA"`],
    ["nothing", ``],
  ])("says nothing about %s", (_name, spec) => {
    expect(itemTypeFromMagicBytes(bytes(spec))).toBeNull();
  });

  it("says nothing without any bytes", () => {
    expect(itemTypeFromMagicBytes(null)).toBeNull();
  });
});
