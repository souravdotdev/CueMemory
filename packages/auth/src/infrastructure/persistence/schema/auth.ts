import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Display name — better-auth's required `name`, mirrored from Google on every sign-in.
    name: text("name").notNull(),
    // Reminder emails go here. Intended to be captured once at sign-up and never
    // overwritten; enforced once better-auth sign-in is wired up (spec #12).
    email: text("email").notNull().unique(),
    // Required by better-auth's user model but not surfaced in @cue-memory/auth's User type.
    emailVerified: boolean("email_verified").notNull().default(false),
    // Drizzle key stays `image` to match better-auth's Drizzle adapter contract;
    // the actual column is named `profile_img` to match the app-facing field name.
    image: text("profile_img"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Set on Account deletion; null = active. See ADR 0001 (30-day grace period, then purge).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  // Partial index so the purge job finds deleted Users cheaply without indexing active ones.
  (table) => [
    index("users_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
