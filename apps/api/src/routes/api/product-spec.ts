import type { FastifyPluginAsync } from "fastify";

import {
  jobSchema,
  productSpecListResponseSchema,
  productSpecSchema,
  productSpecVersionListResponseSchema,
  queueProductSpecGenerationRequestSchema,
  updateProductSpecRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { HttpError } from "../../services/http-error.js";
import { handleRouteError } from "../route-helpers.js";

const projectParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const versionParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    version: { type: "integer", minimum: 1 },
  },
  required: ["id", "version"],
  additionalProperties: false,
} as const;

const assertApprovedOverview = async (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
) => {
  const onePager = await services.onePagerService.getCanonical(ownerUserId, projectId);

  if (!onePager?.approvedAt) {
    throw new HttpError(
      409,
      "overview_approval_required",
      "Approve the overview document before using Product Spec.",
    );
  }
};

export const productSpecRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/product-spec",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedOverview(services, request.user!.id, projectId);
        const productSpec = await services.productSpecService.getCanonical(
          request.user!.id,
          projectId,
        );

        return productSpecListResponseSchema.parse({ productSpec });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/product-spec",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await services.projectService.getOwnedProject(request.user!.id, projectId);
        await assertApprovedOverview(services, request.user!.id, projectId);
        const payload = queueProductSpecGenerationRequestSchema.parse(request.body);
        const type =
          payload.mode === "generate"
            ? "GenerateProductSpec"
            : payload.mode === "regenerate"
              ? "RegenerateProductSpec"
              : "GenerateProductSpecImprovements";
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type,
          inputs: payload,
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/projects/:id/product-spec",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedOverview(services, request.user!.id, projectId);
        const canonical = await services.productSpecService.getCanonical(
          request.user!.id,
          projectId,
        );

        if (!canonical) {
          throw new HttpError(404, "product_spec_not_found", "Product Spec not found.");
        }

        const payload = updateProductSpecRequestSchema.parse(request.body);
        const productSpec = await services.productSpecService.createVersion({
          projectId,
          title: canonical.title,
          markdown: payload.markdown,
          source: "ManualEdit",
        });

        return productSpecSchema.parse(productSpec);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/product-spec/versions",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedOverview(services, request.user!.id, projectId);
        const versions = await services.productSpecService.listVersions(
          request.user!.id,
          projectId,
        );

        return productSpecVersionListResponseSchema.parse({ versions });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/product-spec/versions/:version/restore",
    {
      schema: {
        params: versionParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string; version: number }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedOverview(services, request.user!.id, projectId);
        const productSpec = await services.productSpecService.restoreVersion(
          request.user!.id,
          projectId,
          Number((request.params as { id: string; version: number }).version),
        );

        return productSpecSchema.parse(productSpec);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/product-spec/approve",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedOverview(services, request.user!.id, projectId);
        const productSpec = await services.productSpecService.approveCanonical(
          request.user!.id,
          projectId,
        );

        return productSpecSchema.parse(productSpec);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
