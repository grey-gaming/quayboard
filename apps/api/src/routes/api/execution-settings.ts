import type { FastifyPluginAsync } from "fastify";

import {
  executionSettingsSchema,
  updateExecutionSettingsRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const executionSettingsJsonSchema = {
  type: "object",
  properties: {
    defaultImage: { type: "string", minLength: 1 },
    dockerHost: { type: ["string", "null"] },
    maxConcurrentRuns: { type: "integer", minimum: 1 },
    defaultTimeoutSeconds: { type: "integer", minimum: 1 },
    defaultCpuLimit: { type: "number", exclusiveMinimum: 0 },
    defaultMemoryMb: { type: "integer", minimum: 1 },
  },
  required: [
    "defaultImage",
    "dockerHost",
    "maxConcurrentRuns",
    "defaultTimeoutSeconds",
    "defaultCpuLimit",
    "defaultMemoryMb",
  ],
  additionalProperties: false,
} as const;

export const executionSettingsRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/settings/execution",
    {
      schema: {
        response: {
          200: executionSettingsJsonSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        return executionSettingsSchema.parse(
          await services.executionSettingsService.get(),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/settings/execution",
    {
      schema: {
        body: executionSettingsJsonSchema,
        response: {
          200: executionSettingsJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const payload = updateExecutionSettingsRequestSchema.parse(request.body);
        return executionSettingsSchema.parse(
          await services.executionSettingsService.update(payload),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
