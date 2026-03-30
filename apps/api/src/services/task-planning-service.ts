import { and, asc, desc, eq } from "drizzle-orm";

import {
  type ClarificationStatus,
  type DeliveryTaskStatus,
  type TaskPlanningSessionStatus,
  clarificationStatusSchema,
  deliveryTaskSchema,
  deliveryTaskStatusSchema,
  implementationRecordSchema,
  taskClarificationSchema,
  taskPlanningSessionSchema,
  type TaskPlanningSession,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  featureCasesTable,
  featureDeliveryTasksTable,
  featureRevisionsTable,
  featureTaskClarificationsTable,
  featureTaskPlanningSessionsTable,
  featureTechRevisionsTable,
  implementationRecordsTable,
  jobsTable,
  projectsTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { MilestoneService } from "./milestone-service.js";
import type { FeatureWorkstreamService } from "./feature-workstream-service.js";
import {
  buildTaskPlanningReadinessMessage,
  isTaskPlanningReady,
} from "./task-planning-support.js";

const toTaskPlanningSession = (
  record: typeof featureTaskPlanningSessionsTable.$inferSelect,
): TaskPlanningSession =>
  taskPlanningSessionSchema.parse({
    id: record.id,
    featureId: record.featureId,
    status: record.status,
    createdByJobId: record.createdByJobId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

const toTaskClarification = (
  record: typeof featureTaskClarificationsTable.$inferSelect,
) =>
  taskClarificationSchema.parse({
    id: record.id,
    sessionId: record.sessionId,
    position: record.position,
    question: record.question,
    context: record.context,
    status: record.status,
    answer: record.answer,
    answerSource: record.answerSource,
    answeredAt: record.answeredAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  });

const toDeliveryTask = (record: typeof featureDeliveryTasksTable.$inferSelect) =>
  deliveryTaskSchema.parse({
    id: record.id,
    sessionId: record.sessionId,
    position: record.position,
    title: record.title,
    description: record.description,
    instructions: record.instructions,
    acceptanceCriteria: record.acceptanceCriteria as string[],
    status: record.status,
    createdByJobId: record.createdByJobId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

const toImplementationRecord = (
  record: typeof implementationRecordsTable.$inferSelect,
) =>
  implementationRecordSchema.parse({
    id: record.id,
    featureId: record.featureId,
    techRevisionId: record.techRevisionId,
    commitSha: record.commitSha,
    sandboxRunId: record.sandboxRunId,
    implementedAt: record.implementedAt.toISOString(),
  });

export type TaskPlanningService = ReturnType<typeof createTaskPlanningService>;

export const createTaskPlanningService = (
  db: AppDatabase,
  milestoneService?: MilestoneService,
  featureWorkstreamService?: FeatureWorkstreamService,
) => ({
  async getFeatureContext(ownerUserId: string, featureId: string) {
    const [record] = await db
      .select({
        feature: featureCasesTable,
        project: projectsTable,
      })
      .from(featureCasesTable)
      .innerJoin(projectsTable, eq(projectsTable.id, featureCasesTable.projectId))
      .where(eq(featureCasesTable.id, featureId))
      .limit(1);

    if (!record || record.project.ownerUserId !== ownerUserId || record.feature.archivedAt) {
      throw new HttpError(404, "feature_not_found", "Feature not found.");
    }

    const headFeatureRevision = await db.query.featureRevisionsTable.findFirst({
      where: eq(featureRevisionsTable.featureId, featureId),
      orderBy: [desc(featureRevisionsTable.version)],
    });

    if (!headFeatureRevision) {
      throw new Error(`Missing head feature revision for feature ${featureId}.`);
    }

    return {
      feature: record.feature,
      project: record.project,
      headFeatureRevision,
    };
  },

  async getOrCreateSession(ownerUserId: string, featureId: string) {
    await this.getFeatureContext(ownerUserId, featureId);

    const existing = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.featureId, featureId),
    });

    if (existing) {
      return toTaskPlanningSession(existing);
    }

    const tracks = featureWorkstreamService
      ? await featureWorkstreamService.getTracks(ownerUserId, featureId)
      : null;

    if (tracks && !isTaskPlanningReady(tracks.tracks)) {
      throw new HttpError(
        400,
        "task_planning_documents_required",
        buildTaskPlanningReadinessMessage(tracks.tracks),
      );
    }

    const now = new Date();
    const session: typeof featureTaskPlanningSessionsTable.$inferInsert = {
      id: generateId(),
      featureId,
      status: "pending_clarifications" as TaskPlanningSessionStatus,
      createdByJobId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(featureTaskPlanningSessionsTable).values(session);

    return toTaskPlanningSession(session as typeof featureTaskPlanningSessionsTable.$inferSelect);
  },

  async getSession(ownerUserId: string, featureId: string) {
    await this.getFeatureContext(ownerUserId, featureId);

    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.featureId, featureId),
    });

    return session ? toTaskPlanningSession(session) : null;
  },

  async getClarifications(ownerUserId: string, sessionId: string) {
    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.id, sessionId),
    });

    if (!session) {
      throw new HttpError(404, "session_not_found", "Task planning session not found.");
    }

    await this.getFeatureContext(ownerUserId, session.featureId);

    const clarifications = await db.query.featureTaskClarificationsTable.findMany({
      where: eq(featureTaskClarificationsTable.sessionId, sessionId),
      orderBy: [asc(featureTaskClarificationsTable.position)],
    });

    return clarifications.map(toTaskClarification);
  },

  async answerClarification(
    ownerUserId: string,
    featureId: string,
    clarificationId: string,
    answer: string,
    answerSource: "manual" | "auto",
  ) {
    await this.getFeatureContext(ownerUserId, featureId);

    const clarification = await db.query.featureTaskClarificationsTable.findFirst({
      where: eq(featureTaskClarificationsTable.id, clarificationId),
    });

    if (!clarification) {
      throw new HttpError(404, "clarification_not_found", "Clarification question not found.");
    }

    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.id, clarification.sessionId),
    });

    if (!session || session.featureId !== featureId) {
      throw new HttpError(404, "clarification_not_found", "Clarification question not found.");
    }

    const now = new Date();
    await db
      .update(featureTaskClarificationsTable)
      .set({
        status: "answered" as ClarificationStatus,
        answer,
        answerSource,
        answeredAt: now,
      })
      .where(eq(featureTaskClarificationsTable.id, clarificationId));

    const remaining = await db.query.featureTaskClarificationsTable.findMany({
      where: and(
        eq(featureTaskClarificationsTable.sessionId, clarification.sessionId),
        eq(featureTaskClarificationsTable.status, "pending"),
      ),
    });

    if (remaining.length === 0) {
      await db
        .update(featureTaskPlanningSessionsTable)
        .set({
          status: "clarifications_answered" as TaskPlanningSessionStatus,
          updatedAt: now,
        })
        .where(eq(featureTaskPlanningSessionsTable.id, clarification.sessionId));
    }

    const updated = await db.query.featureTaskClarificationsTable.findFirst({
      where: eq(featureTaskClarificationsTable.id, clarificationId),
    });

    return toTaskClarification(updated!);
  },

  async getTasks(ownerUserId: string, sessionId: string) {
    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.id, sessionId),
    });

    if (!session) {
      throw new HttpError(404, "session_not_found", "Task planning session not found.");
    }

    await this.getFeatureContext(ownerUserId, session.featureId);

    const tasks = await db.query.featureDeliveryTasksTable.findMany({
      where: eq(featureDeliveryTasksTable.sessionId, sessionId),
      orderBy: [asc(featureDeliveryTasksTable.position)],
    });

    return tasks.map(toDeliveryTask);
  },

  async generateClarifications(ownerUserId: string, featureId: string) {
    const context = await this.getFeatureContext(ownerUserId, featureId);

    const session = await this.getOrCreateSession(ownerUserId, featureId);

    if (session.status !== "pending_clarifications" && session.status !== "clarifications_generated") {
      throw new HttpError(
        400,
        "invalid_session_status",
        "Clarifications can only be generated when session is in pending_clarifications or clarifications_generated status.",
      );
    }

    const now = new Date();
    const job: typeof jobsTable.$inferInsert = {
      id: generateId(),
      projectId: context.feature.projectId,
      createdByUserId: ownerUserId,
      parentJobId: null,
      dependencyJobId: null,
      type: "GenerateTaskClarifications",
      status: "queued",
      inputs: {
        featureId,
        sessionId: session.id,
      },
      outputs: null,
      error: null,
      queuedAt: now,
      startedAt: null,
      completedAt: null,
    };

    await db.insert(jobsTable).values(job);

    return { id: job.id, status: job.status, type: job.type };
  },

  async autoAnswerClarifications(ownerUserId: string, featureId: string) {
    const context = await this.getFeatureContext(ownerUserId, featureId);

    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.featureId, featureId),
    });

    if (!session) {
      throw new HttpError(404, "session_not_found", "Task planning session not found.");
    }

    if (session.status !== "clarifications_generated") {
      throw new HttpError(
        400,
        "invalid_session_status",
        "Auto-answer can only be triggered when session is in clarifications_generated status.",
      );
    }

    const now = new Date();
    const job: typeof jobsTable.$inferInsert = {
      id: generateId(),
      projectId: context.feature.projectId,
      createdByUserId: ownerUserId,
      parentJobId: null,
      dependencyJobId: null,
      type: "AutoAnswerTaskClarifications",
      status: "queued",
      inputs: {
        featureId,
        sessionId: session.id,
      },
      outputs: null,
      error: null,
      queuedAt: now,
      startedAt: null,
      completedAt: null,
    };

    await db.insert(jobsTable).values(job);

    return { id: job.id, status: job.status, type: job.type };
  },

  async generateTasks(ownerUserId: string, featureId: string) {
    const context = await this.getFeatureContext(ownerUserId, featureId);

    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.featureId, featureId),
    });

    if (!session) {
      throw new HttpError(404, "session_not_found", "Task planning session not found.");
    }

    if (session.status !== "clarifications_answered" && session.status !== "tasks_generated") {
      throw new HttpError(
        400,
        "invalid_session_status",
        "Tasks can only be generated when session is in clarifications_answered or tasks_generated status.",
      );
    }

    const now = new Date();
    const job: typeof jobsTable.$inferInsert = {
      id: generateId(),
      projectId: context.feature.projectId,
      createdByUserId: ownerUserId,
      parentJobId: null,
      dependencyJobId: null,
      type: "GenerateFeatureTaskList",
      status: "queued",
      inputs: {
        featureId,
        sessionId: session.id,
      },
      outputs: null,
      error: null,
      queuedAt: now,
      startedAt: null,
      completedAt: null,
    };

    await db.insert(jobsTable).values(job);

    return { id: job.id, status: job.status, type: job.type };
  },

  async createImplementationRecord(
    ownerUserId: string,
    featureId: string,
    techRevisionId: string,
    commitSha: string | null,
    sandboxRunId: string | null,
  ) {
    await this.getFeatureContext(ownerUserId, featureId);

    const techRevision = await db.query.featureTechRevisionsTable.findFirst({
      where: eq(featureTechRevisionsTable.id, techRevisionId),
    });

    if (!techRevision) {
      throw new HttpError(404, "tech_revision_not_found", "Tech revision not found.");
    }

    const existing = await db.query.implementationRecordsTable.findFirst({
      where: eq(implementationRecordsTable.featureId, featureId),
    });

    if (existing) {
      const now = new Date();
      await db
        .update(implementationRecordsTable)
        .set({
          techRevisionId,
          commitSha,
          sandboxRunId,
          implementedAt: now,
        })
        .where(eq(implementationRecordsTable.id, existing.id));

      const updated = await db.query.implementationRecordsTable.findFirst({
        where: eq(implementationRecordsTable.id, existing.id),
      });

      return toImplementationRecord(updated!);
    }

    const now = new Date();
    const record: typeof implementationRecordsTable.$inferInsert = {
      id: generateId(),
      featureId,
      techRevisionId,
      commitSha,
      sandboxRunId,
      implementedAt: now,
    };

    await db.insert(implementationRecordsTable).values(record);

    return toImplementationRecord(record as typeof implementationRecordsTable.$inferSelect);
  },

  async getImplementationRecords(ownerUserId: string, featureId: string) {
    await this.getFeatureContext(ownerUserId, featureId);

    const records = await db.query.implementationRecordsTable.findMany({
      where: eq(implementationRecordsTable.featureId, featureId),
      orderBy: [desc(implementationRecordsTable.implementedAt)],
    });

    return records.map(toImplementationRecord);
  },

  async setSessionStatus(sessionId: string, status: TaskPlanningSessionStatus) {
    const now = new Date();
    await db
      .update(featureTaskPlanningSessionsTable)
      .set({ status, updatedAt: now })
      .where(eq(featureTaskPlanningSessionsTable.id, sessionId));
  },

  async createClarifications(
    sessionId: string,
    clarifications: Array<{ question: string; context?: string | null }>,
  ) {
    const now = new Date();

    await db
      .delete(featureTaskClarificationsTable)
      .where(eq(featureTaskClarificationsTable.sessionId, sessionId));

    for (let i = 0; i < clarifications.length; i++) {
      const clarification = clarifications[i];
      await db.insert(featureTaskClarificationsTable).values({
        id: generateId(),
        sessionId,
        position: i,
        question: clarification.question,
        context: clarification.context ?? null,
        status: "pending" as ClarificationStatus,
        answer: null,
        answerSource: null,
        answeredAt: null,
        createdAt: now,
      });
    }

    await this.setSessionStatus(sessionId, "clarifications_generated");
  },

  async createTasks(
    sessionId: string,
    tasks: Array<{
      title: string;
      description: string;
      instructions?: string | null;
      acceptanceCriteria: string[];
    }>,
  ) {
    const now = new Date();

    await db
      .delete(featureDeliveryTasksTable)
      .where(eq(featureDeliveryTasksTable.sessionId, sessionId));

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      await db.insert(featureDeliveryTasksTable).values({
        id: generateId(),
        sessionId,
        position: i,
        title: task.title,
        description: task.description,
        instructions: task.instructions ?? null,
        acceptanceCriteria: task.acceptanceCriteria,
        status: "pending" as DeliveryTaskStatus,
        createdByJobId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.setSessionStatus(sessionId, "tasks_generated");

    const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
      where: eq(featureTaskPlanningSessionsTable.id, sessionId),
    });
    if (session) {
      const feature = await db.query.featureCasesTable.findFirst({
        where: eq(featureCasesTable.id, session.featureId),
      });
      if (feature) {
        await milestoneService?.invalidateReconciliation(feature.milestoneId);
      }
    }
  },

  async createTask(
    ownerUserId: string,
    featureId: string,
    data: {
      title: string;
      description: string;
      instructions?: string;
      acceptanceCriteria?: string[];
      status?: DeliveryTaskStatus;
    },
  ) {
    await this.getFeatureContext(ownerUserId, featureId);

    const session = await this.getOrCreateSession(ownerUserId, featureId);

    const maxPositionResult = await db
      .select({ position: featureDeliveryTasksTable.position })
      .from(featureDeliveryTasksTable)
      .where(eq(featureDeliveryTasksTable.sessionId, session.id))
      .orderBy(desc(featureDeliveryTasksTable.position))
      .limit(1);

    const nextPosition = maxPositionResult[0]?.position != null 
      ? maxPositionResult[0].position + 1 
      : 0;

    const now = new Date();
    const taskId = generateId();

    await db.insert(featureDeliveryTasksTable).values({
      id: taskId,
      sessionId: session.id,
      position: nextPosition,
      title: data.title,
      description: data.description,
      instructions: data.instructions ?? null,
      acceptanceCriteria: data.acceptanceCriteria ?? [],
      status: data.status ?? "pending",
      createdByJobId: null,
      createdAt: now,
      updatedAt: now,
    });

    const record = await db.query.featureDeliveryTasksTable.findFirst({
      where: eq(featureDeliveryTasksTable.id, taskId),
    });

    const feature = await db.query.featureCasesTable.findFirst({
      where: eq(featureCasesTable.id, featureId),
    });
    if (feature) {
      await milestoneService?.invalidateReconciliation(feature.milestoneId);
    }

    return toDeliveryTask(record!);
  },

  async updateTask(
    ownerUserId: string,
    featureId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      instructions?: string | null;
      acceptanceCriteria?: string[];
      status?: DeliveryTaskStatus;
    },
  ) {
    await this.getFeatureContext(ownerUserId, featureId);

    const existingTask = await db.query.featureDeliveryTasksTable.findFirst({
      where: eq(featureDeliveryTasksTable.id, taskId),
    });

    if (!existingTask) {
      throw new HttpError(404, "task_not_found", "Task not found.");
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.instructions !== undefined) {
      updateData.instructions = data.instructions;
    }
    if (data.acceptanceCriteria !== undefined) {
      updateData.acceptanceCriteria = data.acceptanceCriteria;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    await db
      .update(featureDeliveryTasksTable)
      .set(updateData)
      .where(eq(featureDeliveryTasksTable.id, taskId));

    const record = await db.query.featureDeliveryTasksTable.findFirst({
      where: eq(featureDeliveryTasksTable.id, taskId),
    });

    const feature = await db.query.featureCasesTable.findFirst({
      where: eq(featureCasesTable.id, featureId),
    });
    if (feature) {
      await milestoneService?.invalidateReconciliation(feature.milestoneId);
    }

    return toDeliveryTask(record!);
  },

  async deleteTask(ownerUserId: string, featureId: string, taskId: string) {
    await this.getFeatureContext(ownerUserId, featureId);

    const existingTask = await db.query.featureDeliveryTasksTable.findFirst({
      where: eq(featureDeliveryTasksTable.id, taskId),
    });

    if (!existingTask) {
      throw new HttpError(404, "task_not_found", "Task not found.");
    }

    await db
      .delete(featureDeliveryTasksTable)
      .where(eq(featureDeliveryTasksTable.id, taskId));

    const feature = await db.query.featureCasesTable.findFirst({
      where: eq(featureCasesTable.id, featureId),
    });
    if (feature) {
      await milestoneService?.invalidateReconciliation(feature.milestoneId);
    }

    return { success: true };
  },
});
