import { describe, expect, it } from "vitest";
import { ErrorResponseSchema } from "./index";

describe("ErrorResponseSchema", () => {
  it.each(["validation_failed", "not_found", "unauthorized", "rate_limited", "internal"])(
    "accepts the %s code",
    (code) => {
      const body = { error: { code, message: "Something happened" } };

      expect(ErrorResponseSchema.parse(body)).toEqual(body);
    },
  );

  it("carries optional details", () => {
    const body = {
      error: { code: "validation_failed", message: "Invalid input", details: [{ path: ["url"] }] },
    };

    expect(ErrorResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects an unknown code", () => {
    const body = { error: { code: "teapot", message: "I'm a teapot" } };

    expect(ErrorResponseSchema.safeParse(body).success).toBe(false);
  });
});
