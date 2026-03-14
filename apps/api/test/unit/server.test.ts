import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/server.js";

describe("GET /healthz", () => {
  it("returns the expected payload", async () => {
    const server = await buildServer({ corsOrigin: "http://localhost:3000" });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/healthz",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });
});
