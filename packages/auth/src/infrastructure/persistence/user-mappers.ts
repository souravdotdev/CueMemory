import type { User } from "../../domain/user";
import { users } from "./schema/auth";

// `emailVerified`/`updatedAt` are better-auth internals with no use case —
// deliberately dropped here rather than spread, and `image` (the Drizzle key
// better-auth's adapter expects) is renamed to `profileImg` to match the
// domain type.
export function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    profileImg: row.image,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
  };
}
