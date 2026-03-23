import type { FastifyPluginAsync } from "fastify";

import {
  answerClarificationRequestSchema,
  createImplementationRecordRequestSchema,
  createTaskRequestSchema,
  generateClarificationsRequestSchema,
  generateTasksRequestSchema,
  implementationRecordListResponseSchema,
  taskClarificationSchema,
  taskListResponseSchema,
  taskPlanningSessionResponseSchema,
  updateTaskRequestSchema,
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

const emptyJsonSchema = {
  type: "object",
  additionalProperties: false,
} as const;

const clarificationParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    clarificationId: { type: "string", format: "uuid" },
  },
  required: ["id", "clarificationId"],
  additionalProperties: false,
} as const;

const taskPlanningParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const answerClarificationJsonSchema = {
  type: "object",
  properties: {
    answer: { type: "string", minLength: 1 },
  },
  required: ["answer"],
  additionalProperties: false,
} as const;

const createImplementationRecordJsonSchema = {
  type: "object",
  properties: {
    techRevisionId: { type: "string", format: "uuid" },
    commitSha: { type: "string" },
    sandboxRunId: { type: "string" },
  },
  required: ["techRevisionId"],
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

export const taskPlanningRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/features/:id/task-planning-session",
    { schema: { params: featureParamsJsonSchema } },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const session = await services.taskPlanningService.getOrCreateSession(
          request.user!.id,
          featureId,
        );

        const clarifications = await services.taskPlanningService.getClarifications(
          request.user!.id,
          session.id,
        );

        const tasks =
          session.status === "tasks_generated"
            ? await services.taskPlanningService.getTasks(request.user!.id, session.id)
            : [];

        return taskPlanningSessionResponseSchema.parse({
          session,
          clarifications,
          tasks,
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/features/:id/task-planning-session/clarifications",
    {
      schema: {
        params: featureParamsJsonSchema,
        body: emptyJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const job = await services.taskPlanningService.generateClarifications(
          request.user!.id,
          featureId,
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return { job: { id: job.id, status: job.status, type: job.type } };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/features/:id/task-planning-session/clarifications",
    { schema: { params: featureParamsJsonSchema } },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const session = await services.taskPlanningService.getSession(request.user!.id, featureId);
        if (!session) {
          return { clarifications: [] };
        }

        const clarifications = await services.taskPlanningService.getClarifications(
          request.user!.id,
          session.id,
        );

        return { clarifications: clarifications.map((c) => taskClarificationSchema.parse(c)) };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/features/:id/task-planning-session/clarifications/:clarificationId",
    {
      schema: {
        params: clarificationParamsJsonSchema,
        body: answerClarificationJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const clarificationId = (request.params as { clarificationId: string }).clarificationId;
        const body = request.body as { answer: string };

        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const clarification = await services.taskPlanningService.answerClarification(
          request.user!.id,
          featureId,
          clarificationId,
          body.answer,
          "manual",
        );

        return taskClarificationSchema.parse(clarification);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/features/:id/task-planning-session/clarifications/auto-answer",
    {
      schema: {
        params: featureParamsJsonSchema,
        body: emptyJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const job = await services.taskPlanningService.autoAnswerClarifications(
          request.user!.id,
          featureId,
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return { job: { id: job.id, status: job.status, type: job.type } };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/features/:id/task-planning-session/tasks/generate",
    {
      schema: {
        params: featureParamsJsonSchema,
        body: emptyJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const job = await services.taskPlanningService.generateTasks(
          request.user!.id,
          featureId,
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return { job: { id: job.id, status: job.status, type: job.type } };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/features/:id/task-planning-session/tasks",
    { schema: { params: featureParamsJsonSchema } },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const session = await services.taskPlanningService.getSession(request.user!.id, featureId);
        if (!session) {
          return { tasks: [] };
        }

        const tasks = await services.taskPlanningService.getTasks(request.user!.id, session.id);

        return { tasks };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/features/:id/implementation-records",
    {
      schema: {
        params: featureParamsJsonSchema,
        body: createImplementationRecordJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const body = request.body as { techRevisionId: string; commitSha?: string; sandboxRunId?: string };

        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const record = await services.taskPlanningService.createImplementationRecord(
          request.user!.id,
          featureId,
          body.techRevisionId,
          body.commitSha ?? null,
          body.sandboxRunId ?? null,
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return implementationRecordListResponseSchema.parse({ records: [record] });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/features/:id/implementation-records",
    { schema: { params: featureParamsJsonSchema } },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const records = await services.taskPlanningService.getImplementationRecords(
          request.user!.id,
          featureId,
        );

        return implementationRecordListResponseSchema.parse({ records });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  const createTaskJsonSchema = {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 500 },
      description: { type: "string", minLength: 1, maxLength: 5000 },
      instructions: { type: "string", maxLength: 10000 },
      acceptanceCriteria: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 1000 },
      },
      status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked"] },
    },
    required: ["title", "description"],
    additionalProperties: false,
  } as const;

  const updateTaskJsonSchema = {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 500 },
      description: { type: "string", minLength: 1, maxLength: 5000 },
      instructions: { type: "string", maxLength: 10000, nullable: true },
      acceptanceCriteria: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 1000 },
      },
      status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked"] },
    },
    additionalProperties: false,
  } as const;

  const taskIdParamsJsonSchema = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      taskId: { type: "string", format: "uuid" },
    },
    required: ["id", "taskId"],
    additionalProperties: false,
  } as const;

  app.post(
    "/features/:id/task-planning-session/tasks",
    {
      schema: {
        params: featureParamsJsonSchema,
        body: createTaskJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const body = request.body as {
          title: string;
          description: string;
          instructions?: string;
          acceptanceCriteria?: string[];
          status?: "pending" | "in_progress" | "completed" | "blocked";
        };

        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const task = await services.taskPlanningService.createTask(
          request.user!.id,
          featureId,
          {
            title: body.title,
            description: body.description,
            instructions: body.instructions,
            acceptanceCriteria: body.acceptanceCriteria,
            status: body.status,
          },
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return taskListResponseSchema.parse({ tasks: [task] });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/features/:id/task-planning-session/tasks/:taskId",
    {
      schema: {
        params: taskIdParamsJsonSchema,
        body: updateTaskJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const taskId = (request.params as { taskId: string }).taskId;
        const body = request.body as {
          title?: string;
          description?: string;
          instructions?: string | null;
          acceptanceCriteria?: string[];
          status?: "pending" | "in_progress" | "completed" | "blocked";
        };

        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        const task = await services.taskPlanningService.updateTask(
          request.user!.id,
          featureId,
          taskId,
          {
            title: body.title,
            description: body.description,
            instructions: body.instructions,
            acceptanceCriteria: body.acceptanceCriteria,
            status: body.status,
          },
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return taskListResponseSchema.parse({ tasks: [task] });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/features/:id/task-planning-session/tasks/:taskId",
    {
      schema: { params: taskIdParamsJsonSchema },
    },
    async (request, reply) => {
      try {
        const featureId = (request.params as { id: string }).id;
        const taskId = (request.params as { taskId: string }).taskId;

        const context = await services.taskPlanningService.getFeatureContext(
          request.user!.id,
          featureId,
        );
        await services.projectSetupService.assertSetupCompleted(
          request.user!.id,
          context.feature.projectId,
        );

        await services.taskPlanningService.deleteTask(
          request.user!.id,
          featureId,
          taskId,
        );

        publishFeatureUpdate(
          services,
          context.project.ownerUserId,
          context.feature.projectId,
        );

        return { success: true };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};