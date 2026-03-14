import type { FastifyPluginAsync } from "fastify";

import {
  jobSchema,
  onePagerListResponseSchema,
  onePagerSchema,
  onePagerVersionListResponseSchema,
  queueOnePagerGenerationRequestSchema,
  questionnaireAnswersSchema,
  updateQuestionnaireAnswersRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
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

export const onePagerRoutes = (services: AppServices): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/one-pager",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const onePager = await services.onePagerService.getCanonical(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return onePagerListResponseSchema.parse({ onePager });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/one-pager",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectService.getOwnedProject(request.user!.id, projectId);
        const payload = queueOnePagerGenerationRequestSchema.parse(request.body);
        const type =
          payload.mode === "generate"
            ? "GenerateProjectOverview"
            : payload.mode === "regenerate"
              ? "RegenerateProjectOverview"
              : "GenerateOverviewImprovements";
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

  app.get(
    "/projects/:id/one-pager/versions",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const versions = await services.onePagerService.listVersions(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return onePagerVersionListResponseSchema.parse({ versions });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/one-pager/versions/:version/restore",
    {
      schema: {
        params: versionParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const onePager = await services.onePagerService.restoreVersion(
          request.user!.id,
          (request.params as { id: string; version: number }).id,
          Number((request.params as { id: string; version: number }).version),
        );

        return onePagerSchema.parse(onePager);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/questionnaire-answers",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        await services.projectService.getOwnedProject(
          request.user!.id,
          (request.params as { id: string }).id,
        );
        const answers = await services.questionnaireService.getAnswers(
          (request.params as { id: string }).id,
        );

        return questionnaireAnswersSchema.parse(answers);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/projects/:id/questionnaire-answers",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        await services.projectService.getOwnedProject(
          request.user!.id,
          (request.params as { id: string }).id,
        );
        const payload = updateQuestionnaireAnswersRequestSchema.parse(request.body);
        const answers = await services.questionnaireService.upsertAnswers(
          (request.params as { id: string }).id,
          payload.answers,
        );

        return questionnaireAnswersSchema.parse(answers);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
