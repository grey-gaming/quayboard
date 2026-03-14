import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const milestoneRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/projects/:id/milestones" },
    { method: "POST", url: "/projects/:id/milestones" },
    { method: "POST", url: "/projects/:id/milestones/generate" },
    { method: "PATCH", url: "/milestones/:id" },
    { method: "POST", url: "/milestones/:id" },
  ]);
};
