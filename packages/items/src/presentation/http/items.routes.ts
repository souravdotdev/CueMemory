import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { saveItem, listItems } from "../../application/use-cases";
import type { ItemQueue } from "../../domain/ports/item-queue";
import type { ItemRepository } from "../../domain/ports/item-repository";
import {
  createItemBodySchema,
  createItemResponseSchema,
  errorResponseSchema,
  listItemsResponseSchema,
} from "./item.dto";

export interface ItemRoutesDeps {
  itemRepository: ItemRepository;
  itemQueue: ItemQueue;
}

// TODO: replace with the authenticated user once auth is wired up.
const DEV_USER_ID_HEADER = "x-user-id";

/** Controller layer: DTO schemas validate/type the HTTP boundary, then a use case is called and its result formatted as the response. */
export function itemRoutes(deps: ItemRoutesDeps) {
  return async function registerItemRoutes(app: FastifyInstance) {
    const server = app.withTypeProvider<ZodTypeProvider>();

    server.get(
      "/items",
      {
        schema: {
          response: { 200: listItemsResponseSchema },
        },
      },
      async (request) => {
        const userId = request.headers[DEV_USER_ID_HEADER] as string | undefined;
        if (!userId) return [];

        return listItems(deps, { userId });
      },
    );

    server.post(
      "/items",
      {
        schema: {
          body: createItemBodySchema,
          response: {
            201: createItemResponseSchema,
            401: errorResponseSchema,
          },
        },
      },
      async (request, reply) => {
        const userId = request.headers[DEV_USER_ID_HEADER] as string | undefined;
        if (!userId) {
          return reply.status(401).send({ error: "Missing x-user-id header" });
        }

        const item = await saveItem(deps, { userId, url: request.body.url });

        return reply.status(201).send({ item, collectionId: request.body.collectionId ?? null });
      },
    );
  };
}
