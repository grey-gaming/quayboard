import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const sandboxRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "POST", url: "/projects/:id/sandbox/runs" },
    { method: "GET", url: "/sandbox/runs/:id" },
    { method: "POST", url: "/sandbox/runs/:id/cancel" },
    { method: "GET", url: "/sandbox/containers" },
    { method: "POST", url: "/sandbox/containers" },
    { method: "GET", url: "/sandbox/runs/:id/artifacts/:name" },
  ]);
};
