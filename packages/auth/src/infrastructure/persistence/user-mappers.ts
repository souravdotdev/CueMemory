import type { User } from "../../domain/user";
import { users } from "./schema/auth";

// `name`/`emailVerified`/`updatedAt` are better-auth internals with no use
// case yet — deliberately dropped here rather than spread, and `image` (the
// Drizzle key better-auth's adapter expects) is renamed to `profileImg` to
// match the domain type.
export function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    profileImg: row.image,
    createdAt: row.createdAt.toISOString(),
  };
}
