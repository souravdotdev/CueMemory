import type { Container } from "inversify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { MeResponseSchema } from "@cue-memory/shared/schemas/auth";
import { TOKENS } from "@/di/tokens";
import type { MeController } from "@/interface/controllers/MeController";
import { authMiddleware } from "@/interface/middleware/auth.middleware";

export interface MeRoutesOptions {
  container: Container;
}

/** `GET /me`: who the signed-in User is. The web app uses it for the header and server-side checks. */
export const meRoutes: FastifyPluginAsyncZod<MeRoutesOptions> = async (app, { container }) => {
  // The container builds the controller; the route file never does.
  const meController = () => container.get<MeController>(TOKENS.MeController);

  app.get(
    "/me",
    {
      preHandler: authMiddleware(container),
      schema: { response: { 200: MeResponseSchema } },
    },
    (request) => meController().getMe(request),
  );
};
