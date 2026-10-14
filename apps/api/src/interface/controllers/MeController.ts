import type { FastifyReply, FastifyRequest } from "fastify";
import { inject, injectable } from "inversify";
import type { MeOutput } from "@/application/dto/auth/MeOutput";
import type { GetMeUseCase } from "@/application/use-cases/auth/GetMeUseCase";
import { TOKENS } from "@/di/tokens";
import { signedInUser } from "@/interface/middleware/auth.middleware";

/** HTTP work only for `GET /me`: the User from `authMiddleware` in, the me output out. */
@injectable()
export class MeController {
  constructor(@inject(TOKENS.GetMeUseCase) private readonly getMeUseCase: GetMeUseCase) {}

  getMe = async (request: FastifyRequest, _reply: FastifyReply): Promise<MeOutput> =>
    this.getMeUseCase.execute(signedInUser(request));
}
