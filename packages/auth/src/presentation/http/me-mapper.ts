import type { MeResponse } from "@cue-memory/shared/schemas/auth";
import type { User } from "../../domain";

/** Builds the `GET /me` response: the signed-in User, without the deletion time. */
export function toMeResponseDto(user: User): MeResponse {
  return {
    id: user.id,
    displayName: user.name,
    email: user.email,
    avatarUrl: user.profileImg,
    createdAt: user.createdAt.toISOString(),
  };
}
