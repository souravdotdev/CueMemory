import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { meResponseDtoSchema } from "@cue-memory/contracts/auth";
import type { ResolveSignedInUserDeps } from "../../application";
import { toMeResponseDto } from "./me-mapper";
import { requireUser, signedInUser } from "./require-user";

export type MeRoutesOptions = ResolveSignedInUserDeps;

/** `GET /me`: who the signed-in User is. The web app uses it for the header and server-side checks. */
export const meRoutes: FastifyPluginAsyncZod<MeRoutesOptions> = async (app, deps) => {
  app.get(
    "/me",
    {
      preHandler: requireUser(deps),
      schema: { response: { 200: meResponseDtoSchema } },
    },
    async (request) => toMeResponseDto(signedInUser(request)),
  );
};
