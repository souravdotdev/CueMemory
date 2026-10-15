import type { ItemType } from "@/domain/entities/Item";

/** How many leading bytes the rules below look at at most. */
export const MAGIC_BYTES_LENGTH = 16;

/** The bytes from `start` to `end` as Latin-1 text, so signatures read as strings. */
function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.length <= bytes.length && signature.every((byte, i) => bytes[i] === byte);
}

// ISO base media files (MP4, MOV, M4A, HEIC, AVIF) name their kind in the
// `ftyp` box's major brand, bytes 8–12.
const AUDIO_BRANDS = new Set(["M4A ", "M4B ", "M4P ", "F4A "]);
const IMAGE_BRANDS = new Set(["avif", "avis", "heic", "heix", "heim", "heis", "mif1", "msf1"]);

function itemTypeFromBrand(brand: string): ItemType {
  if (AUDIO_BRANDS.has(brand)) return "audio";
  if (IMAGE_BRANDS.has(brand)) return "image";
  return "video";
}

// RIFF containers name their kind in bytes 8–12.
const RIFF_KINDS: Record<string, ItemType> = { WEBP: "image", WAVE: "audio", "AVI ": "video" };

/**
 * Works out an Item type from the first bytes of a response (its magic
 * bytes), for when the server sends no `Content-Type` or only
 * `application/octet-stream`. Returns null when no signature matches.
 */
export function itemTypeFromMagicBytes(bytes: Uint8Array | null): ItemType | null {
  if (!bytes) return null;
  const head4 = ascii(bytes, 0, 4);

  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image";
  if (["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "image";
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "image";
  }

  if (head4 === "RIFF") return RIFF_KINDS[ascii(bytes, 8, 12)] ?? null;
  if (ascii(bytes, 4, 8) === "ftyp" && bytes.length >= 12) {
    return itemTypeFromBrand(ascii(bytes, 8, 12));
  }

  if (ascii(bytes, 0, 3) === "ID3") return "audio";
  if (head4 === "OggS" || head4 === "fLaC") return "audio";
  // An MPEG audio frame starts with 11 set sync bits.
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return "audio";

  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video";

  if (startsWith(bytes, [0x50, 0x4b]) && [0x03, 0x05, 0x07].includes(bytes[2] ?? -1)) {
    return "file";
  }
  if (startsWith(bytes, [0x1f, 0x8b])) return "file";
  if (startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "file";
  if (head4 === "Rar!") return "file";

  return null;
}
