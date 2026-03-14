import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const autoAdvanceRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "POST", url: "/projects/:id/auto-advance/start" },
    { method: "POST", url: "/projects/:id/auto-advance/stop" },
    { method: "POST", url: "/projects/:id/auto-advance/resume" },
    { method: "POST", url: "/projects/:id/auto-advance/reset" },
    { method: "GET", url: "/projects/:id/auto-advance/status" },
    { method: "POST", url: "/projects/:id/auto-advance/step" },
  ]);
};
