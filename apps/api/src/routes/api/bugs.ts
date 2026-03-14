import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const bugRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/features/:id/bugs" },
    { method: "POST", url: "/features/:id/bugs" },
    { method: "GET", url: "/bugs/:id" },
    { method: "PATCH", url: "/bugs/:id" },
    { method: "POST", url: "/bugs/:id/fix-tasks" },
    { method: "POST", url: "/bugs/:id/verify" },
  ]);
};
