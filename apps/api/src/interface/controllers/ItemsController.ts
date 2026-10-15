import type { FastifyReply, FastifyRequest } from "fastify";
import { inject, injectable } from "inversify";
import type { CreateItemInput } from "@cue-memory/shared/schemas/items";
import type { ItemCardOutput } from "@/application/dto/items/ItemCardOutput";
import type { SaveItemUseCase } from "@/application/use-cases/items/SaveItemUseCase";
import { TOKENS } from "@/di/tokens";
import { signedInUser } from "@/interface/middleware/auth.middleware";

/** HTTP work only for the Item routes: the User and validated body in, the Item card out. */
@injectable()
export class ItemsController {
  constructor(@inject(TOKENS.SaveItemUseCase) private readonly saveItemUseCase: SaveItemUseCase) {}

  create = async (
    request: FastifyRequest<{ Body: CreateItemInput }>,
    reply: FastifyReply,
  ): Promise<ItemCardOutput> => {
    const card = await this.saveItemUseCase.execute({
      userId: signedInUser(request).id,
      url: request.body.url,
    });
    reply.code(201);
    return card;
  };
}
