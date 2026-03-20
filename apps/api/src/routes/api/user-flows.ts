import type { FastifyPluginAsync } from "fastify";

import {
  approveUserFlowsRequestSchema,
  jobSchema,
  upsertUseCaseRequestSchema,
  useCaseListResponseSchema,
  useCaseSchema,
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
  const assertApprovedTechnicalSpec = async (ownerUserId: string, projectId: string) => {
    const technicalSpec = await services.blueprintService.getCanonicalByKind(
      ownerUserId,
      projectId,
      "tech",
    );

    if (!technicalSpec) {
      throw new HttpError(
        409,
        "technical_spec_required",
        "Generate the Technical Spec before using User Flows.",
      );
    }

    const artifactState = await services.artifactApprovalService.getState(
      ownerUserId,
      projectId,
      "blueprint_tech",
      technicalSpec.id,
    );

    if (!artifactState.approval) {
      throw new HttpError(
        409,
        "technical_spec_approval_required",
        "Approve the Technical Spec before using User Flows.",
      );
    }
  };

  app.get(
    "/projects/:id/user-flows",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedTechnicalSpec(request.user!.id, projectId);
        const response = await services.userFlowService.list(
          request.user!.id,
          projectId,
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
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedTechnicalSpec(request.user!.id, projectId);
        const userFlow = await services.userFlowService.create(
          request.user!.id,
          projectId,
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
        const userFlowId = (request.params as { id: string }).id;
        const context = await services.userFlowService.getContext(
          request.user!.id,
          userFlowId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.projectId,
        );
        await assertApprovedTechnicalSpec(request.user!.id, context.projectId);
        const userFlow = await services.userFlowService.update(
          request.user!.id,
          userFlowId,
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
        const userFlowId = (request.params as { id: string }).id;
        const context = await services.userFlowService.getContext(
          request.user!.id,
          userFlowId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.projectId,
        );
        await assertApprovedTechnicalSpec(request.user!.id, context.projectId);
        await services.userFlowService.archive(
          request.user!.id,
          userFlowId,
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
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedTechnicalSpec(request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
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
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedTechnicalSpec(request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
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
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedTechnicalSpec(request.user!.id, projectId);
        const response = await services.userFlowService.approve(
          request.user!.id,
          projectId,
          approveUserFlowsRequestSchema.parse(request.body),
        );

        return useCaseListResponseSchema.parse(response);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
