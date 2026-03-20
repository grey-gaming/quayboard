import type { FastifyPluginAsync } from "fastify";

import {
  decisionCardListResponseSchema,
  jobSchema,
  projectBlueprintListResponseSchema,
  projectBlueprintSchema,
  projectBlueprintVersionListResponseSchema,
  saveBlueprintRequestSchema,
  updateDecisionCardsRequestSchema,
  type BlueprintKind,
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

const kindToDocumentLabel = (kind: BlueprintKind) => (kind === "ux" ? "UX Spec" : "Technical Spec");
const kindToDecisionLabel = (kind: BlueprintKind) =>
  kind === "ux" ? "UX decision tiles" : "Technical decision tiles";

const assertNoActiveGenerationJob = async (
  services: AppServices,
  projectId: string,
  type: "GenerateDecisionDeck" | "GenerateProjectBlueprint",
  kind: BlueprintKind,
) => {
  const existingJob = await services.jobService.findActiveProjectJobByTypeAndKind(projectId, type, kind);

  if (existingJob) {
    throw new HttpError(
      409,
      "job_already_active",
      `${type === "GenerateDecisionDeck" ? kindToDecisionLabel(kind) : kindToDocumentLabel(kind)} generation is already queued or running.`,
    );
  }
};

const assertApprovedProductSpec = async (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
) => {
  const productSpec = await services.productSpecService.getCanonical(ownerUserId, projectId);

  if (!productSpec?.approvedAt) {
    throw new HttpError(
      409,
      "product_spec_approval_required",
      "Approve the Product Spec before using UX Spec.",
    );
  }
};

const assertApprovedUxSpec = async (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
) => {
  const uxSpec = await services.blueprintService.getCanonicalByKind(ownerUserId, projectId, "ux");

  if (!uxSpec) {
    throw new HttpError(
      409,
      "ux_spec_required",
      "Generate the UX Spec before using Technical Spec.",
    );
  }

  const artifactState = await services.artifactApprovalService.getState(
    ownerUserId,
    projectId,
    "blueprint_ux",
    uxSpec.id,
  );

  if (!artifactState.approval) {
    throw new HttpError(
      409,
      "ux_spec_approval_required",
      "Approve the UX Spec before using Technical Spec.",
    );
  }
};

const registerSpecRoutes = (
  app: Parameters<FastifyPluginAsync>[0],
  services: AppServices,
  input: {
    kind: BlueprintKind;
    routePrefix: "/projects/:id/ux-spec" | "/projects/:id/technical-spec";
  },
) => {
  const { kind, routePrefix } = input;
  const assertPhaseGate =
    kind === "ux"
      ? (ownerUserId: string, projectId: string) =>
          assertApprovedProductSpec(services, ownerUserId, projectId)
      : (ownerUserId: string, projectId: string) =>
          assertApprovedUxSpec(services, ownerUserId, projectId);

  app.get(
    `${routePrefix}/decision-tiles`,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);

        return decisionCardListResponseSchema.parse(
          await services.blueprintService.listDecisionCards(request.user!.id, projectId, kind),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    `${routePrefix}/decision-tiles/generate`,
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
        await assertPhaseGate(request.user!.id, projectId);
        await assertNoActiveGenerationJob(services, projectId, "GenerateDecisionDeck", kind);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "GenerateDecisionDeck",
          inputs: { kind },
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    `${routePrefix}/decision-tiles`,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);
        const payload = updateDecisionCardsRequestSchema.parse(request.body);

        return decisionCardListResponseSchema.parse(
          await services.blueprintService.updateDecisionCards(
            request.user!.id,
            projectId,
            kind,
            payload,
          ),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    `${routePrefix}/decision-tiles/accept`,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);

        return decisionCardListResponseSchema.parse(
          await services.blueprintService.acceptDecisionDeck(request.user!.id, projectId, kind),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    routePrefix,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);
        const blueprint = await services.blueprintService.getCanonicalByKind(
          request.user!.id,
          projectId,
          kind,
        );

        return projectBlueprintListResponseSchema.parse({ blueprint });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    routePrefix,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);
        await services.blueprintService.assertAcceptedDecisionDeck(request.user!.id, projectId, kind);
        await assertNoActiveGenerationJob(services, projectId, "GenerateProjectBlueprint", kind);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "GenerateProjectBlueprint",
          inputs: { kind },
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    routePrefix,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);
        const canonical = await services.blueprintService.getCanonicalByKind(
          request.user!.id,
          projectId,
          kind,
        );
        await services.blueprintService.assertAcceptedDecisionDeck(request.user!.id, projectId, kind);
        const requestBody =
          typeof request.body === "object" && request.body !== null
            ? (request.body as { markdown?: unknown; title?: unknown })
            : {};
        const payload = saveBlueprintRequestSchema.parse({
          kind,
          title: requestBody.title ?? canonical?.title ?? kindToDocumentLabel(kind),
          markdown: requestBody.markdown,
        });
        const blueprint = await services.blueprintService.createBlueprintVersion({
          projectId,
          kind,
          title: payload.title,
          markdown: payload.markdown,
          source: canonical ? "ManualEdit" : "ManualSave",
        });

        return projectBlueprintSchema.parse(blueprint);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    `${routePrefix}/versions`,
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        await assertPhaseGate(request.user!.id, projectId);
        const versions = await services.blueprintService.listVersions(request.user!.id, projectId, kind);

        return projectBlueprintVersionListResponseSchema.parse({ versions });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    `${routePrefix}/versions/:version/restore`,
    {
      schema: {
        params: versionParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string; version: number };
        await services.projectSetupService.assertSetupCompleted(request.user!.id, params.id);
        await assertPhaseGate(request.user!.id, params.id);
        const blueprint = await services.blueprintService.restoreVersion(
          request.user!.id,
          params.id,
          kind,
          Number(params.version),
        );

        return projectBlueprintSchema.parse(blueprint);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};

export const blueprintRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  registerSpecRoutes(app, services, {
    kind: "ux",
    routePrefix: "/projects/:id/ux-spec",
  });
  registerSpecRoutes(app, services, {
    kind: "tech",
    routePrefix: "/projects/:id/technical-spec",
  });
};
