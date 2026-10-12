import { eq } from "drizzle-orm";
import type { User, UserRepository, UserSignInChanges } from "../../domain";
import type { AuthDatabase } from "./auth-database";
import { users } from "./schema";
import { toUser } from "./user-mappers";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: AuthDatabase) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row === undefined ? null : toUser(row);
  }

  async recordSignIn(id: string, changes: UserSignInChanges): Promise<void> {
    await this.db
      .update(users)
      .set({
        name: changes.name,
        // The domain's profileImg is the users table's `image` key (column profile_img).
        image: changes.profileImg,
        deletedAt: changes.deletedAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }
}
