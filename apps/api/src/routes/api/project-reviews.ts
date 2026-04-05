import type { FastifyPluginAsync } from "fastify";

import {
  projectReviewDetailResponseSchema,
  projectReviewListResponseSchema,
  startProjectReviewRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const projectParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const reviewParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const publishProjectUpdate = (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
) => {
  services.sseHub.publish(ownerUserId, "project:updated", {
    type: "project:updated",
    projectId,
    resource: "project_review",
  });
};

export const projectReviewRoutes =
  (services: AppServices): FastifyPluginAsync =>
  async (app) => {
    app.get(
      "/projects/:id/project-reviews",
      {
        schema: {
          params: projectParamsJsonSchema,
        },
      },
      async (request, reply) => {
        try {
          const projectId = (request.params as { id: string }).id;
          const sessions = await services.projectReviewService.listSessions(request.user!.id, projectId);
          return projectReviewListResponseSchema.parse({ sessions });
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.get(
      "/projects/:id/project-reviews/latest",
      {
        schema: {
          params: projectParamsJsonSchema,
        },
      },
      async (request, reply) => {
        try {
          const projectId = (request.params as { id: string }).id;
          return projectReviewDetailResponseSchema.parse(
            await services.projectReviewService.getLatestSessionDetail(request.user!.id, projectId),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      "/projects/:id/project-reviews",
      {
        schema: {
          params: projectParamsJsonSchema,
        },
      },
      async (request, reply) => {
        try {
          const projectId = (request.params as { id: string }).id;
          await services.projectReviewService.startReview(
            request.user!.id,
            projectId,
            startProjectReviewRequestSchema.parse(request.body ?? {}).trigger,
          );
          publishProjectUpdate(services, request.user!.id, projectId);
          return projectReviewDetailResponseSchema.parse(
            await services.projectReviewService.getLatestSessionDetail(request.user!.id, projectId),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      "/projects/:id/milestone-plan/finalize",
      {
        schema: {
          params: projectParamsJsonSchema,
        },
      },
      async (request, reply) => {
        try {
          const projectId = (request.params as { id: string }).id;
          const project = await services.projectReviewService.finalizeMilestonePlan(
            request.user!.id,
            projectId,
          );
          publishProjectUpdate(services, request.user!.id, projectId);
          return project;
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      "/projects/:id/milestone-plan/reopen",
      {
        schema: {
          params: projectParamsJsonSchema,
        },
      },
      async (request, reply) => {
        try {
          const projectId = (request.params as { id: string }).id;
          const project = await services.projectReviewService.reopenMilestonePlan(
            request.user!.id,
            projectId,
          );
          publishProjectUpdate(services, request.user!.id, projectId);
          return project;
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      "/project-reviews/:id/retry-fixes",
      {
        schema: {
          params: reviewParamsJsonSchema,
        },
      },
      async (request, reply) => {
        try {
          const reviewId = (request.params as { id: string }).id;
          const result = await services.projectReviewService.retryFixes(request.user!.id, reviewId);
          publishProjectUpdate(services, request.user!.id, result.session!.projectId);
          return projectReviewDetailResponseSchema.parse(result);
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );
  };
