import type { FastifyPluginAsync } from "fastify";

import {
  autoAdvanceSessionSchema,
  autoAdvanceStatusResponseSchema,
  startAutoAdvanceRequestSchema,
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

const autoAdvanceSessionJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    status: { type: "string" },
    currentStep: { type: ["string", "null"] },
    pausedReason: { type: ["string", "null"] },
    autoApproveWhenClear: { type: "boolean" },
    skipReviewSteps: { type: "boolean" },
    skipHumanReview: { type: "boolean" },
    autoRepairMilestoneCoverage: { type: "boolean" },
    creativityMode: { type: "string" },
    retryCount: { type: "integer" },
    reviewCount: { type: "integer" },
    milestoneRepairCount: { type: "integer" },
    ciFixCount: { type: "integer" },
    ciWaitWindowCount: { type: "integer" },
    maxConcurrentJobs: { type: "integer" },
    startedAt: { type: ["string", "null"] },
    pausedAt: { type: ["string", "null"] },
    completedAt: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
  required: [
    "id",
    "projectId",
    "status",
    "currentStep",
    "pausedReason",
    "autoApproveWhenClear",
    "skipReviewSteps",
    "skipHumanReview",
    "autoRepairMilestoneCoverage",
    "creativityMode",
    "retryCount",
    "reviewCount",
    "milestoneRepairCount",
    "ciFixCount",
    "ciWaitWindowCount",
    "maxConcurrentJobs",
    "startedAt",
    "pausedAt",
    "completedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
} as const;

const autoAdvanceStatusResponseJsonSchema = {
  type: "object",
  properties: {
    session: {
      anyOf: [{ type: "null" }, autoAdvanceSessionJsonSchema],
    },
    nextStep: { type: ["string", "null"] },
  },
  required: ["session", "nextStep"],
  additionalProperties: false,
} as const;

const startBodyJsonSchema = {
  type: "object",
  properties: {
    autoApproveWhenClear: { type: "boolean" },
    skipReviewSteps: { type: "boolean" },
    skipHumanReview: { type: "boolean" },
    autoRepairMilestoneCoverage: { type: "boolean" },
    creativityMode: { type: "string", enum: ["conservative", "balanced", "creative"] },
    maxConcurrentJobs: { type: "integer", minimum: 1, maximum: 10 },
  },
  additionalProperties: false,
} as const;

export const autoAdvanceRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/auto-advance/status",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: { 200: autoAdvanceStatusResponseJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await services.autoAdvanceService.getStatus(request.user!.id, id);
        return autoAdvanceStatusResponseSchema.parse(result);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/auto-advance/start",
    {
      schema: {
        params: projectParamsJsonSchema,
        body: startBodyJsonSchema,
        response: { 200: autoAdvanceSessionJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = startAutoAdvanceRequestSchema.parse(request.body);
        const session = await services.autoAdvanceService.start(request.user!.id, id, body);
        return autoAdvanceSessionSchema.parse(session);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/auto-advance/stop",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: { 200: autoAdvanceSessionJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const session = await services.autoAdvanceService.stop(request.user!.id, id);
        return autoAdvanceSessionSchema.parse(session);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/auto-advance/resume",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: { 200: autoAdvanceSessionJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const session = await services.autoAdvanceService.resume(request.user!.id, id);
        return autoAdvanceSessionSchema.parse(session);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/auto-advance/reset",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await services.autoAdvanceService.reset(request.user!.id, id);
        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/auto-advance/skip-milestone-reconciliation",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: { 200: autoAdvanceSessionJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const session = await services.autoAdvanceService.skipMilestoneReconciliation(
          request.user!.id,
          id,
        );
        return autoAdvanceSessionSchema.parse(session);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/auto-advance/step",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: { 200: autoAdvanceSessionJsonSchema },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const session = await services.autoAdvanceService.step(request.user!.id, id);
        return autoAdvanceSessionSchema.parse(session);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
