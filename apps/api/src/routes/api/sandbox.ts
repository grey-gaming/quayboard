import type { FastifyPluginAsync } from "fastify";

import {
  cancelSandboxRunRequestSchema,
  createSandboxRunRequestSchema,
  managedContainerListResponseSchema,
  sandboxMilestoneSessionListResponseSchema,
  sandboxMilestoneSessionSchema,
  sandboxOptionsSchema,
  sandboxRunDetailResponseSchema,
  sandboxRunListResponseSchema,
  sandboxRunSchema,
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

const runParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const artifactParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", minLength: 1 },
  },
  required: ["id", "name"],
  additionalProperties: false,
} as const;

const milestoneParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const projectQuerySchema = {
  type: "object",
  properties: {
    projectId: { type: "string", format: "uuid" },
  },
  required: ["projectId"],
  additionalProperties: false,
} as const;

const createSandboxRunJsonSchema = {
  type: "object",
  properties: {
    featureId: { type: "string", format: "uuid" },
    kind: { type: "string", enum: ["implement", "verify"] },
  },
  required: ["featureId"],
  additionalProperties: false,
} as const;

const cancelSandboxRunJsonSchema = {
  type: "object",
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 500 },
  },
  additionalProperties: false,
} as const;

const disposeContainerJsonSchema = {
  type: "object",
  properties: {
    containerId: { type: "string", minLength: 1 },
  },
  required: ["containerId"],
  additionalProperties: false,
} as const;

const emptyJsonSchema = {
  type: "object",
  additionalProperties: false,
} as const;

export const sandboxRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/sandbox/options",
    {
      schema: {
        params: projectParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        return sandboxOptionsSchema.parse(
          await services.sandboxService.getOptions(
            request.user!.id,
            (request.params as { id: string }).id,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/sandbox/runs",
    {
      schema: {
        params: projectParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        return sandboxRunListResponseSchema.parse(
          await services.sandboxService.listRuns(
            request.user!.id,
            (request.params as { id: string }).id,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/sandbox/runs",
    {
      schema: {
        params: projectParamsSchema,
        body: createSandboxRunJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const run = await services.sandboxService.createRun(
          request.user!.id,
          (request.params as { id: string }).id,
          createSandboxRunRequestSchema.parse(request.body),
        );

        return sandboxRunSchema.parse(run);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/sandbox/runs/:id",
    {
      schema: {
        params: runParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        return sandboxRunDetailResponseSchema.parse(
          await services.sandboxService.getRun(
            request.user!.id,
            (request.params as { id: string }).id,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/sandbox/runs/:id/cancel",
    {
      schema: {
        params: runParamsSchema,
        body: cancelSandboxRunJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const payload = cancelSandboxRunRequestSchema.parse(request.body);
        const run = await services.sandboxService.cancelRun(
          request.user!.id,
          (request.params as { id: string }).id,
          payload.reason ?? null,
        );

        return sandboxRunSchema.parse(run);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/sandbox/containers",
    {
      schema: {
        querystring: projectQuerySchema,
      },
    },
    async (request, reply) => {
      try {
        return managedContainerListResponseSchema.parse(
          await services.sandboxService.listManagedContainers(
            request.user!.id,
            (request.query as { projectId: string }).projectId,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/sandbox/containers",
    {
      schema: {
        body: disposeContainerJsonSchema,
        querystring: projectQuerySchema,
      },
    },
    async (request, reply) => {
      try {
        const payload = request.body as { containerId: string };
        await services.sandboxService.disposeManagedContainer(
          request.user!.id,
          (request.query as { projectId: string }).projectId,
          payload.containerId,
        );
        return { ok: true };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/sandbox/runs/:id/artifacts/:name",
    {
      schema: {
        params: artifactParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string; name: string };
        const artifact = await services.sandboxService.getRunArtifact(
          request.user!.id,
          params.id,
          params.name,
        );
        reply.header("Content-Type", artifact.contentType);
        return reply.send(artifact.content);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/sandbox/milestone-sessions/:id",
    {
      schema: {
        params: milestoneParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        return sandboxMilestoneSessionSchema.parse(
          await services.sandboxService.getMilestoneSession(
            request.user!.id,
            (request.params as { id: string }).id,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/milestones/:id/sandbox-sessions",
    {
      schema: {
        params: milestoneParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        return sandboxMilestoneSessionListResponseSchema.parse(
          await services.sandboxService.listMilestoneSessions(
            request.user!.id,
            (request.params as { id: string }).id,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/milestones/:id/sandbox-sessions",
    {
      schema: {
        params: milestoneParamsSchema,
        body: emptyJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        return sandboxMilestoneSessionSchema.parse(
          await services.sandboxService.createMilestoneSession(
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
