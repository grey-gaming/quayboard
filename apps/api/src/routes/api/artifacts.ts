import type { FastifyPluginAsync } from "fastify";

import {
  artifactApprovalSchema,
  artifactApprovalStateResponseSchema,
  artifactTypeSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const projectArtifactParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    type: { type: "string" },
    artifactId: { type: "string", format: "uuid" },
  },
  required: ["id", "type", "artifactId"],
  additionalProperties: false,
} as const;

export const artifactRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/artifacts/:type/:artifactId/approval",
    {
      schema: {
        params: projectArtifactParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { artifactId: string; id: string; type: string };
        const artifactType = artifactTypeSchema.parse(params.type);
        const state = await services.artifactApprovalService.getState(
          request.user!.id,
          params.id,
          artifactType,
          params.artifactId,
        );

        return artifactApprovalStateResponseSchema.parse(state);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/artifacts/:type/:artifactId/approve",
    {
      schema: {
        params: projectArtifactParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { artifactId: string; id: string; type: string };
        const artifactType = artifactTypeSchema.parse(params.type);
        const approval = await services.artifactApprovalService.approve(
          request.user!.id,
          params.id,
          artifactType,
          params.artifactId,
        );

        return artifactApprovalSchema.parse(approval);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
