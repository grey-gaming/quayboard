import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const artifactRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/projects/:id/artifacts/:type/:artifactId/state" },
    { method: "GET", url: "/projects/:id/artifacts/:type/:artifactId/review-items" },
    { method: "POST", url: "/projects/:id/artifacts/:type/:artifactId/review/run" },
    { method: "PATCH", url: "/artifact-review-items/:id" },
    { method: "POST", url: "/projects/:id/artifacts/:type/:artifactId/approve" },
  ]);
};
