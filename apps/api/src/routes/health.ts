import type { FastifyPluginAsync } from "fastify";

import {
  healthResponseJsonSchema,
  healthResponseSchema,
} from "@quayboard/shared";

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/healthz",
    {
      schema: {
        response: {
          200: healthResponseJsonSchema,
        },
      },
    },
    async () => healthResponseSchema.parse({ status: "ok" }),
  );
};
