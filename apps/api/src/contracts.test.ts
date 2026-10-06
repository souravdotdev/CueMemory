import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { errorDtoSchema } from "@cue-memory/contracts/common";
import { registerContracts } from "./contracts";

// A test-only route that declares a body and a response contract, so the
// shared wiring (type provider + error handler) can be exercised end to end.
async function buildApp() {
  const app = registerContracts(Fastify());
  await app.register(rateLimit, { max: 3, timeWindow: "1 minute" });

  app.post(
    "/echo",
    {
      schema: {
        body: z.object({ name: z.string().min(1) }),
        response: { 200: z.object({ name: z.string() }) },
      },
    },
    async (request) => ({ name: request.body.name, secret: "internal-only" }),
  );

  app.get("/boom", async () => {
    throw new Error("connect ECONNREFUSED db.internal:5432");
  });

  return app;
}

describe("API contract wiring", () => {
  it("serializes a valid request through the response contract", async () => {
    const app = await buildApp();

    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "Ada" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ name: "Ada" });
  });

  it("strips a response field the contract doesn't declare", async () => {
    const app = await buildApp();

    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "Ada" } });

    expect(res.body).not.toContain("secret");
    expect(res.body).not.toContain("internal-only");
  });

  it("rejects invalid input with 400 validation_failed and the issues in details", async () => {
    const app = await buildApp();

    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "" } });

    expect(res.statusCode).toBe(400);
    const body = errorDtoSchema.parse(res.json());
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toEqual([{ path: "/name", message: expect.any(String) }]);
  });

  it("turns an unexpected throw into 500 internal without leaking internals", async () => {
    const app = await buildApp();

    const res = await app.inject({ method: "GET", url: "/boom" });

    expect(res.statusCode).toBe(500);
    expect(errorDtoSchema.parse(res.json()).error.code).toBe("internal");
    expect(res.body).not.toContain("ECONNREFUSED");
    expect(res.body).not.toContain("db.internal");
  });

  it("sends rate-limit rejections as 429 rate_limited in the same envelope", async () => {
    const app = await buildApp();

    for (let i = 0; i < 3; i++) await app.inject({ method: "GET", url: "/boom" });
    const res = await app.inject({ method: "GET", url: "/boom" });

    expect(res.statusCode).toBe(429);
    expect(errorDtoSchema.parse(res.json()).error.code).toBe("rate_limited");
  });

  it("sends an unmapped client error as validation_failed with a generic message, not Fastify's", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/x-secret-format" },
      payload: "name=Ada",
    });

    expect(res.statusCode).toBe(415);
    const body = errorDtoSchema.parse(res.json());
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.message).toBe("The request could not be processed");
    expect(res.body).not.toContain("x-secret-format");
  });

  it("sends unknown routes as 404 not_found in the same envelope", async () => {
    const app = await buildApp();

    const res = await app.inject({ method: "GET", url: "/nope" });

    expect(res.statusCode).toBe(404);
    expect(errorDtoSchema.parse(res.json()).error.code).toBe("not_found");
  });
});
