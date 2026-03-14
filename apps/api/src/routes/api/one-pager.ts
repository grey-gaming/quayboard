import type { FastifyPluginAsync } from "fastify";

import { registerNotImplementedRoutes } from "../route-helpers.js";

export const onePagerRoutes: FastifyPluginAsync = async (app) => {
  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/projects/:id/one-pager" },
    { method: "POST", url: "/projects/:id/one-pager" },
    { method: "GET", url: "/projects/:id/one-pager/versions" },
    { method: "POST", url: "/projects/:id/one-pager/versions/:version/restore" },
    { method: "GET", url: "/projects/:id/questionnaire-answers" },
    { method: "PATCH", url: "/projects/:id/questionnaire-answers" },
  ]);
};
