import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "../src/schemas/health.js";

describe("healthResponseSchema", () => {
  it("parses the expected payload", () => {
    expect(healthResponseSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
  });
});
