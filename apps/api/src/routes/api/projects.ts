import type { FastifyPluginAsync } from "fastify";

import {
  createProjectRequestSchema,
  projectListResponseSchema,
  projectSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const projectJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    state: { type: "string" },
    ownerUserId: { type: "string", format: "uuid" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "name",
    "description",
    "state",
    "ownerUserId",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
} as const;

const createProjectBodyJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: ["string", "null"], maxLength: 500 },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

const projectParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

export const projectsRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.post(
    "/projects",
    {
      schema: {
        body: createProjectBodyJsonSchema,
        response: {
          200: projectJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const project = await services.projectService.createProject(
          request.user!.id,
          createProjectRequestSchema.parse(request.body),
        );

        return projectSchema.parse(project);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              projects: {
                type: "array",
                items: projectJsonSchema,
              },
            },
            required: ["projects"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projects = await services.projectService.listProjects(request.user!.id);
        return projectListResponseSchema.parse({ projects });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: projectJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const project = await services.projectService.getOwnedProject(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return projectSchema.parse(project);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
