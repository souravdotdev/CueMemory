import { relations } from "drizzle-orm";
import { collections, items, itemsToCollections, itemsToTags, reminders, tags } from "./items";

// `items.user`/`collections.user` (the forward side of the auth FK) are
// intentionally not declared here — nothing in the codebase queries them
// (grep-verified), and keeping them out is what makes this package have
// zero runtime dependency on @cue-memory/auth (only a schema-level one,
// for the FK column type). The FK columns themselves are unaffected.
export const itemsRelations = relations(items, ({ many }) => ({
  reminders: many(reminders),
  itemsToTags: many(itemsToTags),
  itemsToCollections: many(itemsToCollections),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  itemsToTags: many(itemsToTags),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  itemsToCollections: many(itemsToCollections),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  item: one(items, { fields: [reminders.itemId], references: [items.id] }),
}));

export const itemsToTagsRelations = relations(itemsToTags, ({ one }) => ({
  item: one(items, { fields: [itemsToTags.itemId], references: [items.id] }),
  tag: one(tags, { fields: [itemsToTags.tagId], references: [tags.id] }),
}));

export const itemsToCollectionsRelations = relations(itemsToCollections, ({ one }) => ({
  item: one(items, { fields: [itemsToCollections.itemId], references: [items.id] }),
  collection: one(collections, {
    fields: [itemsToCollections.collectionId],
    references: [collections.id],
  }),
}));
