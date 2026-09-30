import { describe, expect, it } from "vitest";
import { errorDtoSchema } from "./index";

describe("errorDtoSchema", () => {
  it.each(["validation_failed", "not_found", "unauthorized", "rate_limited", "internal"])(
    "accepts the %s code",
    (code) => {
      const body = { error: { code, message: "Something happened" } };

      expect(errorDtoSchema.parse(body)).toEqual(body);
    },
  );

  it("carries optional details", () => {
    const body = {
      error: { code: "validation_failed", message: "Invalid input", details: [{ path: ["url"] }] },
    };

    expect(errorDtoSchema.parse(body)).toEqual(body);
  });

  it("rejects an unknown code", () => {
    const body = { error: { code: "teapot", message: "I'm a teapot" } };

    expect(errorDtoSchema.safeParse(body).success).toBe(false);
  });
});
