import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const featureRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/projects/:id/features/graph" },
    { method: "GET", url: "/projects/:id/features" },
    { method: "POST", url: "/projects/:id/features" },
    { method: "GET", url: "/projects/:id/features/:featureId" },
    { method: "PATCH", url: "/projects/:id/features/:featureId" },
    { method: "GET", url: "/projects/:id/features/:featureId/tasks" },
  ]);
};
