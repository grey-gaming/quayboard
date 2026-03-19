import type { FastifyPluginAsync } from "fastify";

import {
  artifactApprovalSchema,
  artifactReviewItemSchema,
  artifactReviewItemsResponseSchema,
  artifactStateResponseSchema,
  artifactTypeSchema,
  jobSchema,
  updateArtifactReviewItemRequestSchema,
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

const reviewItemParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const artifactTypeToJobType = (artifactType: "blueprint_ux" | "blueprint_tech") =>
  artifactType === "blueprint_ux" ? "ReviewBlueprintUX" : "ReviewBlueprintTech";

export const artifactRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/artifacts/:type/:artifactId/state",
    {
      schema: {
        params: projectArtifactParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { artifactId: string; id: string; type: string };
        const artifactType = artifactTypeSchema.parse(params.type);
        const state = await services.artifactReviewService.getState(
          request.user!.id,
          params.id,
          artifactType,
          params.artifactId,
        );

        return artifactStateResponseSchema.parse(state);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/artifacts/:type/:artifactId/review-items",
    {
      schema: {
        params: projectArtifactParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { artifactId: string; id: string; type: string };
        const artifactType = artifactTypeSchema.parse(params.type);
        const response = await services.artifactReviewService.listItems(
          request.user!.id,
          params.id,
          artifactType,
          params.artifactId,
        );

        return artifactReviewItemsResponseSchema.parse(response);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/artifacts/:type/:artifactId/review/run",
    {
      schema: {
        params: projectArtifactParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { artifactId: string; id: string; type: string };
        const artifactType = artifactTypeSchema.parse(params.type);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId: params.id,
          type: artifactTypeToJobType(artifactType),
          inputs: {
            artifactId: params.artifactId,
            artifactType,
          },
        });
        await services.artifactReviewService.createRun(
          request.user!.id,
          params.id,
          artifactType,
          params.artifactId,
          job.id,
        );

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/artifact-review-items/:id",
    {
      schema: {
        params: reviewItemParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string };
        const payload = updateArtifactReviewItemRequestSchema.parse(request.body);
        const item = await services.artifactReviewService.updateReviewItem(
          request.user!.id,
          params.id,
          payload.status,
        );

        return artifactReviewItemSchema.parse(item);
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
        const approval = await services.artifactReviewService.approve(
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
