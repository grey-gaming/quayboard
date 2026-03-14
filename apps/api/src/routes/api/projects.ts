import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  createProjectRequestSchema,
  nextActionsResponseSchema,
  phaseGatesResponseSchema,
  projectListResponseSchema,
  projectSchema,
  projectSetupStatusSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { HttpError } from "../../services/http-error.js";
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

const updateProjectRequestSchema = z.object({
  description: z.string().trim().max(500).optional().nullable(),
  evidencePolicy: z
    .object({
      requireArchitectureDocs: z.boolean(),
      requireUserDocs: z.boolean(),
    })
    .optional(),
  llmConfig: z
    .object({
      provider: z.enum(["ollama", "openai"]),
      model: z.string().min(1),
    })
    .optional(),
  name: z.string().trim().min(1).max(120).optional(),
  repoConfig: z
    .object({
      owner: z.string().min(1),
      provider: z.literal("github"),
      repo: z.string().min(1),
    })
    .optional(),
  sandboxConfig: z
    .object({
      allowlist: z.array(z.string()).default([]),
      cpuLimit: z.number().positive(),
      egressPolicy: z.enum(["allowlisted", "locked"]),
      memoryMb: z.number().int().positive(),
      timeoutSeconds: z.number().int().positive(),
    })
    .optional(),
  toolPolicyPreview: z
    .object({
      budgetCapUsd: z.number().positive().nullable(),
      enabledGroups: z.array(z.string().min(1)),
    })
    .optional(),
});

const updateProjectBodyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: ["string", "null"], maxLength: 500 },
    repoConfig: {
      type: "object",
      properties: {
        provider: { const: "github" },
        owner: { type: "string", minLength: 1 },
        repo: { type: "string", minLength: 1 },
      },
      required: ["provider", "owner", "repo"],
      additionalProperties: false,
    },
    llmConfig: {
      type: "object",
      properties: {
        provider: { type: "string" },
        model: { type: "string", minLength: 1 },
      },
      required: ["provider", "model"],
      additionalProperties: false,
    },
    sandboxConfig: {
      type: "object",
      properties: {
        allowlist: { type: "array", items: { type: "string" } },
        cpuLimit: { type: "number", exclusiveMinimum: 0 },
        egressPolicy: { type: "string" },
        memoryMb: { type: "integer", minimum: 1 },
        timeoutSeconds: { type: "integer", minimum: 1 },
      },
      required: [
        "allowlist",
        "cpuLimit",
        "egressPolicy",
        "memoryMb",
        "timeoutSeconds",
      ],
      additionalProperties: false,
    },
    evidencePolicy: {
      type: "object",
      properties: {
        requireArchitectureDocs: { type: "boolean" },
        requireUserDocs: { type: "boolean" },
      },
      required: ["requireArchitectureDocs", "requireUserDocs"],
      additionalProperties: false,
    },
    toolPolicyPreview: {
      type: "object",
      properties: {
        budgetCapUsd: { type: ["number", "null"] },
        enabledGroups: { type: "array", items: { type: "string" } },
      },
      required: ["budgetCapUsd", "enabledGroups"],
      additionalProperties: false,
    },
  },
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

  app.patch(
    "/projects/:id",
    {
      schema: {
        params: projectParamsJsonSchema,
        body: updateProjectBodyJsonSchema,
        response: {
          200: projectJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        const payload = updateProjectRequestSchema.parse(request.body);

        if (payload.repoConfig) {
          await services.projectSetupService.configureRepo(
            request.user!.id,
            projectId,
            payload.repoConfig,
          );
        }

        if (payload.llmConfig) {
          await services.projectSetupService.configureLlm(
            request.user!.id,
            projectId,
            payload.llmConfig,
          );
        }

        if (payload.sandboxConfig) {
          await services.projectSetupService.configureSandbox(
            request.user!.id,
            projectId,
            payload.sandboxConfig,
          );
        }

        if (payload.evidencePolicy || payload.toolPolicyPreview) {
          await services.projectSetupService.configurePreferences(
            request.user!.id,
            projectId,
            {
              evidencePolicy:
                payload.evidencePolicy ?? {
                  requireArchitectureDocs: false,
                  requireUserDocs: false,
                },
              toolPolicyPreview:
                payload.toolPolicyPreview ?? {
                  budgetCapUsd: null,
                  enabledGroups: ["planning", "review"],
                },
            },
          );
        }

        const project = await services.projectService.updateOwnedProject(
          request.user!.id,
          projectId,
          {
            description: payload.description,
            name: payload.name,
          },
        );

        return projectSchema.parse(project);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/setup-status",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              repoConnected: { type: "boolean" },
              llmVerified: { type: "boolean" },
              sandboxVerified: { type: "boolean" },
              checks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    status: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["key", "label", "status", "message"],
                  additionalProperties: false,
                },
              },
            },
            required: ["repoConnected", "llmVerified", "sandboxVerified", "checks"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const status = await services.projectSetupService.getSetupStatus(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return projectSetupStatusSchema.parse(status);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/verify-llm",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              repoConnected: { type: "boolean" },
              llmVerified: { type: "boolean" },
              sandboxVerified: { type: "boolean" },
              checks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    status: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["key", "label", "status", "message"],
                  additionalProperties: false,
                },
              },
            },
            required: ["repoConnected", "llmVerified", "sandboxVerified", "checks"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const status = await services.projectSetupService.verifyLlm(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return projectSetupStatusSchema.parse(status);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/verify-sandbox",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              repoConnected: { type: "boolean" },
              llmVerified: { type: "boolean" },
              sandboxVerified: { type: "boolean" },
              checks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    status: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["key", "label", "status", "message"],
                  additionalProperties: false,
                },
              },
            },
            required: ["repoConnected", "llmVerified", "sandboxVerified", "checks"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const status = await services.projectSetupService.verifySandbox(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return projectSetupStatusSchema.parse(status);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/generate-description",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          202: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              projectId: { type: ["string", "null"], format: "uuid" },
              type: { type: "string" },
              status: { type: "string" },
              inputs: {},
              outputs: {},
              error: {},
              queuedAt: { type: "string", format: "date-time" },
              startedAt: { type: ["string", "null"], format: "date-time" },
              completedAt: { type: ["string", "null"], format: "date-time" },
            },
            required: [
              "id",
              "projectId",
              "type",
              "status",
              "inputs",
              "outputs",
              "error",
              "queuedAt",
              "startedAt",
              "completedAt",
            ],
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectService.getOwnedProject(request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "GenerateProjectDescription",
        });

        return reply.status(202).send(job);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/complete-one-pager-onboarding",
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
        const projectId = (request.params as { id: string }).id;
        const onePager = await services.onePagerService.getCanonical(
          request.user!.id,
          projectId,
        );

        if (!onePager) {
          throw new HttpError(
            409,
            "one_pager_required",
            "Generate an overview document before approval.",
          );
        }

        await services.onePagerService.approveCanonical(request.user!.id, projectId);

        const project = await services.projectService.getOwnedProject(
          request.user!.id,
          projectId,
        );

        return projectSchema.parse(project);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/phase-gates",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              phases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    phase: { type: "string" },
                    passed: { type: "boolean" },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          label: { type: "string" },
                          passed: { type: "boolean" },
                        },
                        required: ["key", "label", "passed"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["phase", "passed", "items"],
                  additionalProperties: false,
                },
              },
            },
            required: ["phases"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const response = await services.phaseGateService.build(
          request.user!.id,
          (request.params as { id: string }).id,
        );
        return phaseGatesResponseSchema.parse(response);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/next-actions",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    href: { type: "string" },
                  },
                  required: ["key", "label", "href"],
                  additionalProperties: false,
                },
              },
            },
            required: ["actions"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const response = await services.nextActionsService.build(
          request.user!.id,
          (request.params as { id: string }).id,
        );
        return nextActionsResponseSchema.parse(response);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
