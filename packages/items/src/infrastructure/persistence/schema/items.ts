import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
