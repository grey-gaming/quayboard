import type { FastifyPluginAsync } from "fastify";

import {
  featureTracksResponseSchema,
  featureWorkstreamRevisionListResponseSchema,
  jobSchema,
  type FeatureWorkstreamKind,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const featureParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const featureRevisionParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    revisionId: { type: "string", format: "uuid" },
  },
  required: ["id", "revisionId"],
  additionalProperties: false,
} as const;

const publishFeatureUpdate = (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
) => {
  services.sseHub.publish(ownerUserId, "project:updated", {
    type: "project:updated",
    projectId,
    resource: "feature",
  });
};

const generationJobTypes: Record<FeatureWorkstreamKind, string> = {
  product: "GenerateFeatureProductSpec",
  ux: "GenerateFeatureUxSpec",
  tech: "GenerateFeatureTechSpec",
  user_docs: "GenerateFeatureUserDocs",
  arch_docs: "GenerateFeatureArchDocs",
};

const routePrefixes: Record<FeatureWorkstreamKind, string> = {
  product: "product",
  ux: "ux",
  tech: "tech",
  user_docs: "user-doc",
  arch_docs: "arch-doc",
};

export const featureWorkstreamRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/features/:id/tracks",
    { schema: { params: featureParamsJsonSchema } },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.featureWorkstreamService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        return featureTracksResponseSchema.parse(
          await services.featureWorkstreamService.getTracks(request.user!.id, featureId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  const registerKindRoutes = (kind: FeatureWorkstreamKind) => {
    const prefix = routePrefixes[kind];

    app.get(
      `/features/:id/${prefix}-revisions`,
      { schema: { params: featureParamsJsonSchema } },
      async (request, reply) => {
        try {
          const featureId = (request.params as { id: string }).id;
          const context = await services.featureWorkstreamService.getFeatureContext(
            request.user!.id,
            featureId,
          );
          await services.projectSetupService.assertSetupCompleted(
            request.user!.id,
            context.feature.projectId,
          );

          return featureWorkstreamRevisionListResponseSchema.parse(
            await services.featureWorkstreamService.listRevisions(
              request.user!.id,
              featureId,
              kind,
            ),
          );
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      `/features/:id/${prefix}-revisions`,
      { schema: { params: featureParamsJsonSchema } },
      async (request, reply) => {
        try {
          const featureId = (request.params as { id: string }).id;
          const context = await services.featureWorkstreamService.getFeatureContext(
            request.user!.id,
            featureId,
          );
          await services.projectSetupService.assertSetupCompleted(
            request.user!.id,
            context.feature.projectId,
          );

          const revisions = await services.featureWorkstreamService.createRevision(
            request.user!.id,
            featureId,
            kind,
            request.body,
          );
          publishFeatureUpdate(services, request.user!.id, context.feature.projectId);

          return featureWorkstreamRevisionListResponseSchema.parse(revisions);
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      `/features/:id/${prefix}-revisions/generate`,
      { schema: { params: featureParamsJsonSchema } },
      async (request, reply) => {
        try {
          const featureId = (request.params as { id: string }).id;
          const context = await services.featureWorkstreamService.getFeatureContext(
            request.user!.id,
            featureId,
          );
          await services.projectSetupService.assertSetupCompleted(
            request.user!.id,
            context.feature.projectId,
          );

          const job = await services.jobService.createJob({
            createdByUserId: request.user!.id,
            projectId: context.feature.projectId,
            type: generationJobTypes[kind],
            inputs: {
              featureId,
            },
          });

          return reply.status(202).send(jobSchema.parse(job));
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );

    app.post(
      `/features/:id/${prefix}-revisions/:revisionId/approve`,
      { schema: { params: featureRevisionParamsJsonSchema } },
      async (request, reply) => {
        try {
          const params = request.params as { id: string; revisionId: string };
          const context = await services.featureWorkstreamService.getFeatureContext(
            request.user!.id,
            params.id,
          );
          await services.projectSetupService.assertSetupCompleted(
            request.user!.id,
            context.feature.projectId,
          );

          const revisions = await services.featureWorkstreamService.approveRevision(
            request.user!.id,
            params.id,
            kind,
            params.revisionId,
          );
          publishFeatureUpdate(services, request.user!.id, context.feature.projectId);

          return featureWorkstreamRevisionListResponseSchema.parse(revisions);
        } catch (error) {
          return handleRouteError(reply, error);
        }
      },
    );
  };

  registerKindRoutes("product");
  registerKindRoutes("ux");
  registerKindRoutes("tech");
  registerKindRoutes("user_docs");
  registerKindRoutes("arch_docs");
};
