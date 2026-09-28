import { relations } from "drizzle-orm";
import { accounts, sessions, users } from "./auth";

// `users.items`/`users.collections` (the reverse side of the items feature's
// FK) are intentionally not declared here — nothing in the codebase queries
// them (grep-verified), and keeping them out is what makes this package have
// zero dependency on @second-brain/items. The FK columns themselves live
// unaffected in @second-brain/items' own schema.
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));
