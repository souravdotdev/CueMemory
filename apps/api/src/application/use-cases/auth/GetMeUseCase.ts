import { injectable } from "inversify";
import type { MeOutput } from "@/application/dto/auth/MeOutput";
import type { User } from "@/domain/entities/User";

/** Who the signed-in User is, for the web app's header and server-side checks. */
@injectable()
export class GetMeUseCase {
  execute(user: User): MeOutput {
    return {
      id: user.id,
      displayName: user.name,
      email: user.email,
      avatarUrl: user.profileImg,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
