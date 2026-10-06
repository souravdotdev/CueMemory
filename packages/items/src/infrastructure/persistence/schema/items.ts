import { users } from "@cue-memory/auth/schema";
import { type SQL, sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { ITEM_STATUSES, ITEM_TYPES } from "../../../domain/item";

export const itemTypeEnum = pgEnum("item_type", ITEM_TYPES);

export const itemStatusEnum = pgEnum("item_status", ITEM_STATUSES);

// Postgres full-text search vector; drizzle-orm has no built-in tsvector column.
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// Only this much extracted text is indexed, keeping the vector well under Postgres's
// 1 MB tsvector limit so a very long Item never fails to save.
const MAX_INDEXED_TEXT_LENGTH = 100_000;

// One weighted part of search_vector; A ranks highest, C lowest.
const weighted = (text: SQL, weight: "A" | "B" | "C"): SQL =>
  sql`setweight(to_tsvector('english', ${text}), '${sql.raw(weight)}')`;

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
    // Readable text, deliberately uncapped; keyword search reads it through search_vector.
    extractedText: text("extracted_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Keyword search, kept up to date by Postgres: title, then description, then extracted text.
    searchVector: tsvector("search_vector").generatedAlwaysAs((): SQL =>
      sql.join(
        [
          weighted(sql`coalesce(${items.title}, '')`, "A"),
          weighted(sql`coalesce(${items.description}, '')`, "B"),
          weighted(
            sql`left(coalesce(${items.extractedText}, ''), ${sql.raw(String(MAX_INDEXED_TEXT_LENGTH))})`,
            "C",
          ),
        ],
        sql` || `,
      ),
    ),
  },
  (table) => [
    // Lets tag links (#11) require an Item and a tag to belong to the same User.
    unique("items_id_user_id_unique").on(table.id, table.userId),
    // Serves "this User's Items, newest first" (the feed and per-User counts).
    index("items_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
    // Serves keyword search.
    index("items_search_vector_idx").using("gin", table.searchVector),
    // A finished (Ready or Failed) Item always has an Item type.
    check(
      "items_type_set_when_finished",
      sql`${table.status} = 'processing' OR ${table.type} IS NOT NULL`,
    ),
    // A Source URL is always http(s).
    check("items_source_url_http", sql`${table.sourceUrl} ~* '^https?://'`),
  ],
);
