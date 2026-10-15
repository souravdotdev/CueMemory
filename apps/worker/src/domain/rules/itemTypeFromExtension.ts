import type { ItemType } from "@/domain/entities/Item";

// Lower-case, without the dot. A File is a download that isn't a PDF, Image,
// Video or Audio.
const EXTENSIONS_BY_TYPE: readonly (readonly [ItemType, readonly string[]])[] = [
  ["pdf", ["pdf"]],
  ["image", ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic", "bmp", "tif", "tiff"]],
  ["audio", ["mp3", "wav", "m4a", "ogg", "oga", "opus", "flac", "aac"]],
  ["video", ["mp4", "m4v", "mov", "webm", "mkv", "avi"]],
  [
    "file",
    [
      // archives
      ...["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"],
      // documents
      ...["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "epub"],
      // installers and disk images
      ...["dmg", "pkg", "exe", "msi", "apk", "deb", "rpm", "iso"],
    ],
  ],
];

const EXTENSIONS = new Map<string, ItemType>(
  EXTENSIONS_BY_TYPE.flatMap(([type, extensions]) => extensions.map((ext) => [ext, type] as const)),
);

/**
 * Works out an Item type from the extension ending a URL path (any case), or
 * null when the path has no extension this rule knows.
 */
export function itemTypeFromExtension(path: string): ItemType | null {
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1];
  if (!extension) return null;
  return EXTENSIONS.get(extension.toLowerCase()) ?? null;
}
