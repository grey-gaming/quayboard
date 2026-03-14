import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const blueprintRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "POST", url: "/projects/:id/blueprints/generate-deck" },
    { method: "GET", url: "/projects/:id/decision-cards" },
    { method: "PATCH", url: "/projects/:id/decision-cards" },
    { method: "POST", url: "/projects/:id/blueprints/generate" },
    { method: "POST", url: "/projects/:id/blueprints/save" },
    { method: "GET", url: "/projects/:id/blueprints/canonical" },
  ]);
};
