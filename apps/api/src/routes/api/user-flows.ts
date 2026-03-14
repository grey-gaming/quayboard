import type { FastifyPluginAsync } from "fastify";

import {
  approveUserFlowsRequestSchema,
  jobSchema,
  upsertUseCaseRequestSchema,
  useCaseListResponseSchema,
  useCaseSchema,
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

const userFlowParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

export const userFlowRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/user-flows",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const response = await services.userFlowService.list(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return useCaseListResponseSchema.parse(response);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/user-flows",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const userFlow = await services.userFlowService.create(
          request.user!.id,
          (request.params as { id: string }).id,
          upsertUseCaseRequestSchema.parse(request.body),
        );

        return useCaseSchema.parse(userFlow);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/user-flows/:id",
    {
      schema: {
        params: userFlowParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const userFlow = await services.userFlowService.update(
          request.user!.id,
          (request.params as { id: string }).id,
          upsertUseCaseRequestSchema.parse(request.body),
        );

        return useCaseSchema.parse(userFlow);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/user-flows/:id",
    {
      schema: {
        params: userFlowParamsJsonSchema,
        response: {
          204: { type: "null" },
        },
      },
    },
    async (request, reply) => {
      try {
        await services.userFlowService.archive(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/user-flows/generate",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId: (request.params as { id: string }).id,
          type: "GenerateUseCases",
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/user-flows/deduplicate",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId: (request.params as { id: string }).id,
          type: "DeduplicateUseCases",
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/user-flows/approve",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const response = await services.userFlowService.approve(
          request.user!.id,
          (request.params as { id: string }).id,
          approveUserFlowsRequestSchema.parse(request.body),
        );

        return useCaseListResponseSchema.parse(response);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
