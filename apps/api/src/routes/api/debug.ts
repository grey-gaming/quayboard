import type { FastifyPluginAsync } from "fastify";

import {
  buildContextPackRequestSchema,
  contextPackListResponseSchema,
  memoryChunkListResponseSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError, registerNotImplementedRoutes } from "../route-helpers.js";

const projectQuerySchema = {
  type: "object",
  properties: {
    projectId: { type: "string", format: "uuid" },
    featureId: { type: "string", format: "uuid" },
    type: { type: "string", enum: ["planning", "coding"] },
  },
  required: ["projectId"],
  additionalProperties: false,
} as const;

const buildContextPackJsonSchema = {
  type: "object",
  properties: {
    featureId: { type: "string", format: "uuid" },
    type: { type: "string", enum: ["planning", "coding"] },
  },
  additionalProperties: false,
} as const;

export const debugRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/debug/context-packs",
    {
      schema: {
        querystring: projectQuerySchema,
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as {
          featureId?: string;
          projectId: string;
        };
        return contextPackListResponseSchema.parse({
          packs: await services.contextPackService.listContextPacks(
            request.user!.id,
            query.projectId,
            query.featureId,
          ),
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/debug/context-packs/build",
    {
      schema: {
        querystring: projectQuerySchema,
        body: buildContextPackJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as { projectId: string };
        const body = buildContextPackRequestSchema.parse(request.body);
        const pack = await services.contextPackService.buildContextPack(
          request.user!.id,
          query.projectId,
          {
            featureId: body.featureId,
            type: body.type,
          },
        );
        return pack;
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/debug/memory",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            projectId: { type: "string", format: "uuid" },
          },
          required: ["projectId"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as { projectId: string };
        return memoryChunkListResponseSchema.parse({
          chunks: await services.contextPackService.listMemoryChunks(
            request.user!.id,
            query.projectId,
          ),
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  registerNotImplementedRoutes(app, [
    { method: "GET", url: "/debug/health" },
    { method: "GET", url: "/debug/scheduler" },
    { method: "GET", url: "/debug/events" },
  ]);
};
