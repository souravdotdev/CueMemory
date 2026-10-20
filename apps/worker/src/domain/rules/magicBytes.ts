/** The bytes from `start` to `end` as Latin-1 text, so signatures read as strings. */
export function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.length <= bytes.length && signature.every((byte, i) => bytes[i] === byte);
}

export const isJpeg = (bytes: Uint8Array): boolean => startsWith(bytes, [0xff, 0xd8, 0xff]);

export const isPng = (bytes: Uint8Array): boolean =>
  startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const isGif = (bytes: Uint8Array): boolean =>
  ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6));

/** A RIFF container's kind (bytes 8–12, such as `WEBP` or `WAVE`), or null for any other file. */
export function riffKind(bytes: Uint8Array): string | null {
  return ascii(bytes, 0, 4) === "RIFF" ? ascii(bytes, 8, 12) : null;
}

export const isWebp = (bytes: Uint8Array): boolean => riffKind(bytes) === "WEBP";

/**
 * An ISO base media file's (MP4, MOV, M4A, HEIC, AVIF) major brand: the kind
 * its `ftyp` box names in bytes 8–12. Null for any other file.
 */
export function isoMajorBrand(bytes: Uint8Array): string | null {
  return ascii(bytes, 4, 8) === "ftyp" && bytes.length >= 12 ? ascii(bytes, 8, 12) : null;
}

const AVIF_BRANDS = new Set(["avif", "avis"]);

/**
 * An AVIF: an ISO base media file whose `ftyp` box names `avif` (or `avis`)
 * as its major brand or, after a generic `mif1`/`msf1`, among its compatible
 * brands. HEIC, the same box naming `heic`, isn't one.
 */
export function isAvif(bytes: Uint8Array): boolean {
  const major = isoMajorBrand(bytes);
  if (major === null) return false;
  if (AVIF_BRANDS.has(major)) return true;
  if (major !== "mif1" && major !== "msf1") return false;
  // The box's size (big-endian, bytes 0–4) bounds its compatible brands, from byte 16.
  const boxEnd = Math.min(
    bytes.length,
    ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0,
  );
  for (let at = 16; at + 4 <= boxEnd; at += 4) {
    if (AVIF_BRANDS.has(ascii(bytes, at, at + 4))) return true;
  }
  return false;
}
