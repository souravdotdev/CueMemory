import type { User } from "@/domain/entities/User";

/** A User who asked to leave: their Sessions are refused until a User restore or the purge (Auth ADR 0001). */
export function isDeleted(user: User): boolean {
  return user.deletedAt !== null;
}
