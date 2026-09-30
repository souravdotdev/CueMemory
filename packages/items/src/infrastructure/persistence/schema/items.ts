import { users } from "@cue-memory/auth/schema";
import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { ITEM_STATUSES, ITEM_TYPES } from "../../../domain/item";

export const itemTypeEnum = pgEnum("item_type", ITEM_TYPES);

export const itemStatusEnum = pgEnum("item_status", ITEM_STATUSES);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    // Decided during Processing; null only while the Item is Processing.
    type: itemTypeEnum("type"),
    status: itemStatusEnum("status").notNull().default("processing"),
    title: text("title"),
    description: text("description"),
    // Object-storage key: thumbnails/{userId}/{itemId}.<ext>.
    thumbnailKey: text("thumbnail_key"),
    // Readable text used for keyword search; deliberately uncapped.
    extractedText: text("extracted_text"),
    // Set when the Item becomes Failed, cleared on retry.
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Lets tag links (#11) require an Item and a tag to belong to the same User.
    unique("items_id_user_id_unique").on(table.id, table.userId),
    // Serves "this User's Items, newest first" (the feed and per-User counts).
    index("items_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
    // A finished (Ready or Failed) Item always has an Item type.
    check(
      "items_type_set_when_finished",
      sql`${table.status} = 'processing' OR ${table.type} IS NOT NULL`,
    ),
    // A failure reason is present exactly when the Item is Failed.
    check(
      "items_failure_reason_iff_failed",
      sql`(${table.status} = 'failed') = (${table.failureReason} IS NOT NULL)`,
    ),
    // A Source URL is always http(s).
    check("items_source_url_http", sql`${table.sourceUrl} ~* '^https?://'`),
  ],
);
