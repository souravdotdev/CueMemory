// Symbol-based injection tokens for the ports this package defines. Plain
// symbols, not an inversify import — the use-case layer stays framework-free;
// only the composition roots in apps/* know inversify exists.
export const TYPES = {
  ItemRepository: Symbol.for("ItemRepository"),
  ItemQueue: Symbol.for("ItemQueue"),
  MetadataFetcher: Symbol.for("MetadataFetcher"),
} as const;
