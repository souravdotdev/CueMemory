import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Display name — better-auth's required `name`, mirrored from Google on every sign-in.
    name: text("name").notNull(),
    // Where CueMemory emails the User. Intended to be captured once at sign-up and never
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

// A User's Sign-in identities: better-auth's account model, one row per provider identity
// (e.g. their Google account). Only better-auth reads and writes it; no domain entity maps it.
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The provider's own id for the identity (Google's `sub`).
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    // Required by better-auth's account model; stays null because V1 only signs in with Google.
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One provider identity belongs to exactly one User.
    unique("accounts_provider_id_account_id_unique").on(table.providerId, table.accountId),
    // Serves "this User's Sign-in identities" and the cascade on User purge.
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
