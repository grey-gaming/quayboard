import type { FastifyPluginAsync } from "fastify";

import {
  canonicalBlueprintsResponseSchema,
  decisionCardListResponseSchema,
  jobSchema,
  queueBlueprintGenerationRequestSchema,
  saveBlueprintRequestSchema,
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

const assertApprovedUserFlows = async (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
) => {
  const userFlows = await services.userFlowService.list(ownerUserId, projectId);

  if (!userFlows.approvedAt) {
    throw new HttpError(
      409,
      "user_flows_approval_required",
      "Approve user flows before using Blueprint Builder.",
    );
  }
};

export const blueprintRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.post(
    "/projects/:id/blueprints/generate-deck",
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
        await assertApprovedUserFlows(services, request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "GenerateDecisionDeck",
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/decision-cards",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedUserFlows(services, request.user!.id, projectId);

        return decisionCardListResponseSchema.parse(
          await services.blueprintService.listDecisionCards(request.user!.id, projectId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/projects/:id/decision-cards",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedUserFlows(services, request.user!.id, projectId);

        return decisionCardListResponseSchema.parse(
          await services.blueprintService.updateDecisionCards(
            request.user!.id,
            projectId,
            request.body,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/blueprints/generate",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedUserFlows(services, request.user!.id, projectId);
        await services.blueprintService.assertFullySelectedDecisionDeck(request.user!.id, projectId);
        const payload = queueBlueprintGenerationRequestSchema.parse(request.body);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "GenerateProjectBlueprint",
          inputs: payload,
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/blueprints/save",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedUserFlows(services, request.user!.id, projectId);
        await services.blueprintService.assertFullySelectedDecisionDeck(request.user!.id, projectId);
        const payload = saveBlueprintRequestSchema.parse(request.body);
        const blueprint = await services.blueprintService.createBlueprintVersion({
          projectId,
          kind: payload.kind,
          title: payload.title,
          markdown: payload.markdown,
          source: "ManualSave",
        });

        return reply.send(blueprint);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/blueprints/canonical",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertApprovedUserFlows(services, request.user!.id, projectId);
        const blueprints = await services.blueprintService.getCanonical(request.user!.id, projectId);

        return canonicalBlueprintsResponseSchema.parse(blueprints);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
