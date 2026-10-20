import type { ItemType } from "@/domain/entities/Item";
import {
  ascii,
  isGif,
  isJpeg,
  isoMajorBrand,
  isPng,
  riffKind,
  startsWith,
} from "@/domain/rules/magicBytes";

/** How many leading bytes the rules below look at at most. */
export const MAGIC_BYTES_LENGTH = 16;

// The major brands of ISO base media files that are audio or images; any other is a video.
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

  if (isPng(bytes) || isJpeg(bytes) || isGif(bytes)) return "image";
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "image";
  }

  const kind = riffKind(bytes);
  if (kind !== null) return RIFF_KINDS[kind] ?? null;
  const brand = isoMajorBrand(bytes);
  if (brand !== null) return itemTypeFromBrand(brand);

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
