import { getTableColumns } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { items } from "@cue-memory/db/schema";
import { TOKENS } from "@/di/tokens";
import type { Item } from "@/domain/entities/Item";
import type { IItemRepository, NewItem } from "@/domain/repositories/IItemRepository";
import type { Database } from "@/infrastructure/database/Database";
import { toItem } from "@/infrastructure/mappers/itemMapper";

// Every column but search_vector, which is a search detail, not part of the Item.
const { searchVector: _searchVector, ...itemColumns } = getTableColumns(items);

/** Items in the `items` table, through Drizzle. */
@injectable()
export class DrizzleItemRepository implements IItemRepository {
  constructor(@inject(TOKENS.Database) private readonly db: Database) {}

  async create(newItem: NewItem): Promise<Item> {
    // Status defaults to processing and the type stays null until Processing decides it.
    const [row] = await this.db
      .insert(items)
      .values({ userId: newItem.userId, sourceUrl: newItem.sourceUrl })
      .returning(itemColumns);
    return toItem(row!);
  }
}
