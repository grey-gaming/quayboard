import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const documentationRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/features/:id/user-doc-revisions" },
    { method: "POST", url: "/features/:id/user-doc-revisions" },
    { method: "POST", url: "/features/:id/user-doc-revisions/:revisionId/approve" },
    { method: "GET", url: "/features/:id/arch-doc-revisions" },
    { method: "POST", url: "/features/:id/arch-doc-revisions" },
    { method: "POST", url: "/features/:id/arch-doc-revisions/:revisionId/approve" },
  ]);
};
