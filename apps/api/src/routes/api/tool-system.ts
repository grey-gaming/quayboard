import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const toolSystemRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/tool-catalog" },
    { method: "GET", url: "/projects/:id/tool-policy" },
    { method: "PUT", url: "/projects/:id/tool-policy" },
    { method: "GET", url: "/projects/:id/tool-invocations" },
  ]);
};
