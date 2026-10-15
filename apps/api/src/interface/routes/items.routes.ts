import type { Container } from "inversify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CreateItemResponseSchema, CreateItemSchema } from "@cue-memory/shared/schemas/items";
import { TOKENS } from "@/di/tokens";
import type { ItemsController } from "@/interface/controllers/ItemsController";
import { authMiddleware } from "@/interface/middleware/auth.middleware";

export interface ItemsRoutesOptions {
  container: Container;
}

/** `POST /items`: save a pasted URL as a Processing Item. */
export const itemsRoutes: FastifyPluginAsyncZod<ItemsRoutesOptions> = async (
  app,
  { container },
) => {
  // The container builds the controller; the route file never does.
  const itemsController = () => container.get<ItemsController>(TOKENS.ItemsController);

  app.post(
    "/items",
    {
      preHandler: authMiddleware(container),
      schema: { body: CreateItemSchema, response: { 201: CreateItemResponseSchema } },
    },
    // request.body is CreateItemInput, already trimmed and validated
    (request, reply) => itemsController().create(request, reply),
  );
};
