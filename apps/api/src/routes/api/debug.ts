import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const debugRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/debug/health" },
    { method: "GET", url: "/debug/context-packs" },
    { method: "GET", url: "/debug/memory" },
    { method: "GET", url: "/debug/scheduler" },
    { method: "GET", url: "/debug/events" },
  ]);
};
