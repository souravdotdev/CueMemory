import type { ItemType } from "@/domain/entities/Item";
import { mediaTypeOf } from "@/domain/rules/mediaType";

const PDF_TYPES = new Set(["application/pdf", "application/x-pdf"]);

// Downloads that aren't a PDF, image, video or audio: archives, office
// documents, e-books, disk images and installers.
const FILE_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/x-bzip2",
  "application/x-xz",
  "application/zstd",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/java-archive",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/rtf",
  "application/epub+zip",
  "application/x-apple-diskimage",
  "application/x-iso9660-image",
  "application/x-msdownload",
  "application/x-msi",
  "application/vnd.debian.binary-package",
  "application/x-rpm",
  "application/vnd.android.package-archive",
]);
const FILE_TYPE_PREFIXES = [
  "application/vnd.openxmlformats-officedocument.",
  "application/vnd.oasis.opendocument.",
];

/**
 * Works out an Item type from a non-HTML response's `Content-Type`. Returns
 * null for HTML, for a missing or vague one (`application/octet-stream`) and
 * for anything else it doesn't recognise.
 */
export function itemTypeFromContentType(contentType: string | null): ItemType | null {
  const mediaType = mediaTypeOf(contentType);
  if (PDF_TYPES.has(mediaType)) return "pdf";
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("audio/") || mediaType === "application/ogg") return "audio";
  if (mediaType.startsWith("video/")) return "video";
  if (FILE_TYPES.has(mediaType)) return "file";
  if (FILE_TYPE_PREFIXES.some((prefix) => mediaType.startsWith(prefix))) return "file";
  return null;
}
