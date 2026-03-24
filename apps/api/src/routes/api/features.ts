import type { FastifyPluginAsync } from "fastify";

import {
  featureDependencyListResponseSchema,
  featureGraphResponseSchema,
  featureListResponseSchema,
  featureRevisionListResponseSchema,
  featureRollupResponseSchema,
  featureSchema,
  jobSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { registerNotImplementedRoutes, handleRouteError } from "../route-helpers.js";

const projectParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const featureParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const featureDependencyParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    dependsOnFeatureId: { type: "string", format: "uuid" },
  },
  required: ["id", "dependsOnFeatureId"],
  additionalProperties: false,
} as const;

const publishProjectUpdate = (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
  resource: "feature" | "milestone" | "phase_gates",
) => {
  services.sseHub.publish(ownerUserId, "project:updated", {
    type: "project:updated",
    projectId,
    resource,
  });
};

export const featureRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/features/graph",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);

        return featureGraphResponseSchema.parse(
          await services.featureService.getGraph(request.user!.id, projectId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/features/rollup",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);

        return featureRollupResponseSchema.parse(
          await services.featureService.getRollup(request.user!.id, projectId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/features",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);

        return featureListResponseSchema.parse(
          await services.featureService.list(request.user!.id, projectId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/features",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        const feature = await services.featureService.create(
          request.user!.id,
          projectId,
          request.body,
        );
        publishProjectUpdate(services, request.user!.id, projectId, "feature");

        return featureSchema.parse(feature);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/features/append-from-one-pager",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "AppendFeatureFromOnePager",
          inputs: request.body ?? {},
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/features/:id",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        return featureSchema.parse(await services.featureService.get(request.user!.id, featureId));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/features/:id",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.featureService.getContext(request.user!.id, featureId);
        const feature = await services.featureService.update(
          request.user!.id,
          featureId,
          request.body,
        );
        publishProjectUpdate(services, request.user!.id, context.projectId, "feature");

        return featureSchema.parse(feature);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/features/:id",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.featureService.getContext(request.user!.id, featureId);
        await services.featureService.archive(request.user!.id, featureId);
        publishProjectUpdate(services, request.user!.id, context.projectId, "feature");

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/features/:id/revisions",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        return featureRevisionListResponseSchema.parse(
          await services.featureService.listRevisions(request.user!.id, featureId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/features/:id/revisions",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.featureService.getContext(request.user!.id, featureId);
        const revisions = await services.featureService.createRevision(
          request.user!.id,
          featureId,
          request.body,
        );
        publishProjectUpdate(services, request.user!.id, context.projectId, "feature");

        return featureRevisionListResponseSchema.parse(revisions);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/features/:id/dependencies",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        return featureDependencyListResponseSchema.parse(
          await services.featureService.listDependencies(request.user!.id, featureId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/features/:id/dependencies",
    {
      schema: {
        params: featureParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.featureService.getContext(request.user!.id, featureId);
        const dependencies = await services.featureService.addDependency(
          request.user!.id,
          featureId,
          request.body,
        );
        publishProjectUpdate(services, request.user!.id, context.projectId, "feature");

        return featureDependencyListResponseSchema.parse(dependencies);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/features/:id/dependencies/:dependsOnFeatureId",
    {
      schema: {
        params: featureDependencyParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string; dependsOnFeatureId: string };
        const context = await services.featureService.getContext(request.user!.id, params.id);
        const dependencies = await services.featureService.removeDependency(
          request.user!.id,
          params.id,
          params.dependsOnFeatureId,
        );
        publishProjectUpdate(services, request.user!.id, context.projectId, "feature");

        return featureDependencyListResponseSchema.parse(dependencies);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
