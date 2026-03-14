import type { FastifyPluginAsync } from "fastify";

import { jobListResponseSchema, jobSchema } from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const paramsSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const jobJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: { type: ["string", "null"], format: "uuid" },
    type: { type: "string" },
    status: { type: "string" },
    inputs: {},
    outputs: {},
    error: {},
    queuedAt: { type: "string", format: "date-time" },
    startedAt: { type: ["string", "null"], format: "date-time" },
    completedAt: { type: ["string", "null"], format: "date-time" },
  },
  required: [
    "id",
    "projectId",
    "type",
    "status",
    "inputs",
    "outputs",
    "error",
    "queuedAt",
    "startedAt",
    "completedAt",
  ],
  additionalProperties: true,
} as const;

export const jobRoutes = (services: AppServices): FastifyPluginAsync => async (app) => {
  app.get(
    "/jobs",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              jobs: {
                type: "array",
                items: jobJsonSchema,
              },
            },
            required: ["jobs"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const jobs = await services.jobService.listOwnedJobs(request.user!.id);
        return jobListResponseSchema.parse({ jobs });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/jobs",
    {
      schema: {
        params: paramsSchema,
        response: {
          200: {
            type: "object",
            properties: {
              jobs: {
                type: "array",
                items: jobJsonSchema,
              },
            },
            required: ["jobs"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const jobs = await services.jobService.listJobsForProject(
          request.user!.id,
          (request.params as { id: string }).id,
        );
        return jobListResponseSchema.parse({ jobs });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/jobs/:id",
    {
      schema: {
        params: paramsSchema,
        response: {
          200: jobJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const job = await services.jobService.getOwnedJob(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return jobSchema.parse(job);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
