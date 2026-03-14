import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const userFlowRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/projects/:id/user-flows" },
    { method: "POST", url: "/projects/:id/user-flows" },
    { method: "PATCH", url: "/user-flows/:id" },
    { method: "DELETE", url: "/user-flows/:id" },
    { method: "POST", url: "/projects/:id/user-flows/generate" },
    { method: "POST", url: "/projects/:id/user-flows/deduplicate" },
    { method: "POST", url: "/projects/:id/user-flows/approve" },
  ]);
};
