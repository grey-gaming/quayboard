import type { FastifyPluginAsync } from "fastify";

import {
  bugDetailResponseSchema,
  bugListResponseSchema,
  bugReportSchema,
  createBugRequestSchema,
  updateBugRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const projectParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const bugParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const createBugBodySchema = {
  type: "object",
  properties: {
    featureId: { type: "string", format: "uuid" },
    description: { type: "string", minLength: 1, maxLength: 10000 },
  },
  required: ["description"],
  additionalProperties: false,
} as const;

const updateBugBodySchema = {
  type: "object",
  properties: {
    featureId: { type: ["string", "null"], format: "uuid" },
    description: { type: "string", minLength: 1, maxLength: 10000 },
  },
  additionalProperties: false,
} as const;

const emptyBodySchema = {
  type: "object",
  additionalProperties: false,
} as const;

export const bugRoutes =
  (services: AppServices): FastifyPluginAsync =>
  async (app) => {
    app.get(
      "/projects/:id/bugs",
      {
        schema: {
          params: projectParamsSchema,
        },
      },
      async (request, reply) => {
        try {
          return bugListResponseSchema.parse(
            await services.bugService.listBugs(request.user!.id, (request.params as { id: string }).id),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      "/projects/:id/bugs",
      {
        schema: {
          params: projectParamsSchema,
          body: createBugBodySchema,
        },
      },
      async (request, reply) => {
        try {
          return bugReportSchema.parse(
            await services.bugService.createBug(
              request.user!.id,
              (request.params as { id: string }).id,
              createBugRequestSchema.parse(request.body),
            ),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.get(
      "/bugs/:id",
      {
        schema: {
          params: bugParamsSchema,
        },
      },
      async (request, reply) => {
        try {
          return bugDetailResponseSchema.parse(
            await services.bugService.getBug(request.user!.id, (request.params as { id: string }).id),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.patch(
      "/bugs/:id",
      {
        schema: {
          params: bugParamsSchema,
          body: updateBugBodySchema,
        },
      },
      async (request, reply) => {
        try {
          return bugReportSchema.parse(
            await services.bugService.updateBug(
              request.user!.id,
              (request.params as { id: string }).id,
              updateBugRequestSchema.parse(request.body),
            ),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      "/bugs/:id/fix",
      {
        schema: {
          params: bugParamsSchema,
          body: emptyBodySchema,
        },
      },
      async (request, reply) => {
        try {
          return bugReportSchema.parse(
            await services.bugService.startFix(
              request.user!.id,
              (request.params as { id: string }).id,
            ),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );
  };
