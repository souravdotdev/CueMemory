import { eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { users } from "@resonory/db/schema";
import { TOKENS } from "@/di/tokens";
import type { User } from "@/domain/entities/User";
import type { IUserRepository, UserSignInChanges } from "@/domain/repositories/IUserRepository";
import type { Database } from "@/infrastructure/database/Database";
import { toUser } from "@/infrastructure/mappers/userMapper";

/** Users in the `users` table, through Drizzle. */
@injectable()
export class DrizzleUserRepository implements IUserRepository {
  constructor(@inject(TOKENS.Database) private readonly db: Database) {}

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
