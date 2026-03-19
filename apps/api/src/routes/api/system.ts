import type { FastifyPluginAsync } from "fastify";

import { systemReadinessSchema } from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

export const systemRoutes = (services: AppServices): FastifyPluginAsync => async (app) => {
  app.get(
    "/system/readiness",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              checks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    status: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["key", "label", "status", "message"],
                  additionalProperties: false,
                },
              },
            },
            required: ["checks"],
            additionalProperties: false,
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        const readiness = await services.systemReadinessService.getReadiness();
        return systemReadinessSchema.parse(readiness);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
