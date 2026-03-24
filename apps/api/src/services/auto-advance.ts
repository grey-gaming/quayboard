import { and, eq } from "drizzle-orm";

import type {
  AutoAdvanceSession,
  AutoAdvanceStatusResponse,
  StartAutoAdvanceRequest,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  autoAdvanceSessionsTable,
  jobsTable,
  projectsTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { NextActionsService } from "./next-actions-service.js";
import type { JobService } from "./jobs/job-service.js";
import type { SseHub } from "./sse.js";

type AutoAdvanceSessionRow = typeof autoAdvanceSessionsTable.$inferSelect;

const toSession = (row: AutoAdvanceSessionRow): AutoAdvanceSession => ({
  id: row.id,
  projectId: row.projectId,
  status: row.status,
  currentStep: row.currentStep ?? null,
  pausedReason: row.pausedReason ?? null,
  autoApproveWhenClear: row.autoApproveWhenClear,
  skipReviewSteps: row.skipReviewSteps,
  creativityMode: (row.creativityMode ?? "balanced") as AutoAdvanceSession["creativityMode"],
  startedAt: row.startedAt?.toISOString() ?? null,
  pausedAt: row.pausedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Map of next-action keys that are automatable to their job types and input builders.
 * Returns null for steps that require human input.
 */
const AUTOMATABLE_STEPS: Record<
  string,
  | { type: string; buildInputs?: (href: string) => Record<string, unknown> }
  | null
> = {
  questionnaire: { type: "AutoAnswerQuestionnaire" },
  overview: { type: "GenerateProjectOverview" },
  overview_approval: null,
  product_spec: { type: "GenerateProductSpec" },
  product_spec_approval: null,
  ux_decisions_generate: {
    type: "GenerateDecisionDeck",
    buildInputs: () => ({ kind: "ux" }),
  },
  ux_decisions_select: null,
  ux_decisions_accept: null,
  ux_spec_generate: {
    type: "GenerateProjectBlueprint",
    buildInputs: () => ({ kind: "ux" }),
  },
  ux_spec_approval: null,
  tech_decisions_generate: {
    type: "GenerateDecisionDeck",
    buildInputs: () => ({ kind: "tech" }),
  },
  tech_decisions_select: null,
  tech_decisions_accept: null,
  tech_spec_generate: {
    type: "GenerateProjectBlueprint",
    buildInputs: () => ({ kind: "tech" }),
  },
  tech_spec_approval: null,
  user_flows: null,
  milestones_generate: { type: "GenerateMilestones" },
  milestones_approve: null,
  features_create: null,
  feature_product_create: {
    type: "GenerateFeatureProductSpec",
    buildInputs: (href) => {
      const match = href.match(/\/features\/([^/]+)/);
      return { featureId: match?.[1] ?? "" };
    },
  },
  feature_product_approval: null,
  feature_stale_implementation: null,
};

export const createAutoAdvanceService = (
  db: AppDatabase,
  nextActionsService: NextActionsService,
  jobService: JobService,
  sseHub: SseHub,
) => {
  const requireProject = async (ownerUserId: string, projectId: string) => {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    return project;
  };

  const getSession = async (projectId: string) => {
    return db.query.autoAdvanceSessionsTable.findFirst({
      where: eq(autoAdvanceSessionsTable.projectId, projectId),
    });
  };

  const publishSessionUpdate = async (ownerUserId: string, projectId: string) => {
    sseHub.publish(ownerUserId, "auto-advance:updated", { projectId });
  };

  /**
   * Determine the next automatable step for the project and enqueue a job for it.
   * If the next step requires human input, pauses the session with `needs_human`.
   * If there are no next actions, marks the session as completed.
   */
  const advanceStep = async (
    ownerUserId: string,
    projectId: string,
    sessionId: string,
  ) => {
    const { actions } = await nextActionsService.build(ownerUserId, projectId);
    const nextAction = actions[0] ?? null;

    if (!nextAction) {
      // No next actions — planning is complete
      await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "completed",
          currentStep: null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, sessionId));
      return;
    }

    const stepConfig = AUTOMATABLE_STEPS[nextAction.key];

    if (stepConfig === undefined || stepConfig === null) {
      // Not automatable — pause and wait for human
      await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "paused",
          currentStep: nextAction.key,
          pausedReason: "needs_human",
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, sessionId));
      return;
    }

    // Update current step and enqueue job
    await db
      .update(autoAdvanceSessionsTable)
      .set({
        currentStep: nextAction.key,
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, sessionId));

    const inputs = stepConfig.buildInputs ? stepConfig.buildInputs(nextAction.href) : {};

    await jobService.createJob({
      createdByUserId: ownerUserId,
      projectId,
      type: stepConfig.type,
      inputs,
    });
  };

  return {
    async getStatus(ownerUserId: string, projectId: string): Promise<AutoAdvanceStatusResponse> {
      await requireProject(ownerUserId, projectId);

      const session = await getSession(projectId);
      const { actions } = await nextActionsService.build(ownerUserId, projectId);
      const nextStep = actions[0]?.key ?? null;

      return {
        session: session ? toSession(session) : null,
        nextStep,
      };
    },

    async start(
      ownerUserId: string,
      projectId: string,
      opts: StartAutoAdvanceRequest,
    ): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const existing = await getSession(projectId);

      if (existing && existing.status === "running") {
        throw new HttpError(409, "session_already_running", "An auto-advance session is already running.");
      }

      const now = new Date();

      if (existing) {
        // Restart existing session
        const [updated] = await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "running",
            currentStep: null,
            pausedReason: null,
            autoApproveWhenClear: opts.autoApproveWhenClear ?? existing.autoApproveWhenClear,
            skipReviewSteps: opts.skipReviewSteps ?? existing.skipReviewSteps,
            creativityMode: opts.creativityMode ?? existing.creativityMode,
            startedAt: now,
            pausedAt: null,
            completedAt: null,
            updatedAt: now,
          })
          .where(eq(autoAdvanceSessionsTable.id, existing.id))
          .returning();

        await publishSessionUpdate(ownerUserId, projectId);
        await advanceStep(ownerUserId, projectId, updated.id);
        await publishSessionUpdate(ownerUserId, projectId);
        return toSession(updated);
      }

      const [created] = await db
        .insert(autoAdvanceSessionsTable)
        .values({
          id: generateId(),
          projectId,
          status: "running",
          autoApproveWhenClear: opts.autoApproveWhenClear ?? false,
          skipReviewSteps: opts.skipReviewSteps ?? false,
          creativityMode: opts.creativityMode ?? "balanced",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await publishSessionUpdate(ownerUserId, projectId);
      await advanceStep(ownerUserId, projectId, created.id);
      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(created);
    },

    async stop(ownerUserId: string, projectId: string): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await getSession(projectId);

      if (!session || session.status !== "running") {
        throw new HttpError(409, "session_not_running", "No running auto-advance session found.");
      }

      const [updated] = await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "paused",
          pausedReason: "manual_pause",
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning();

      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(updated);
    },

    async resume(ownerUserId: string, projectId: string): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await getSession(projectId);

      if (!session || session.status !== "paused") {
        throw new HttpError(409, "session_not_paused", "No paused auto-advance session found.");
      }

      const [updated] = await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "running",
          pausedReason: null,
          pausedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning();

      await publishSessionUpdate(ownerUserId, projectId);
      await advanceStep(ownerUserId, projectId, updated.id);
      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(updated);
    },

    async reset(ownerUserId: string, projectId: string): Promise<void> {
      await requireProject(ownerUserId, projectId);

      await db
        .delete(autoAdvanceSessionsTable)
        .where(eq(autoAdvanceSessionsTable.projectId, projectId));

      await publishSessionUpdate(ownerUserId, projectId);
    },

    async step(ownerUserId: string, projectId: string): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await getSession(projectId);

      if (!session) {
        throw new HttpError(404, "session_not_found", "No auto-advance session exists for this project.");
      }

      if (session.status === "running") {
        throw new HttpError(409, "session_already_running", "Session is already running.");
      }

      const [updated] = await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "running",
          pausedReason: null,
          pausedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning();

      await publishSessionUpdate(ownerUserId, projectId);
      await advanceStep(ownerUserId, projectId, updated.id);
      // Re-pause after a single step
      const afterStep = await getSession(projectId);
      if (afterStep?.status === "running") {
        await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "paused",
            pausedReason: "manual_pause",
            pausedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, session.id));
      }
      await publishSessionUpdate(ownerUserId, projectId);
      const final = await getSession(projectId);
      return toSession(final ?? updated);
    },

    /**
     * Called by the job scheduler after a job completes (success or failure).
     * If there is a running auto-advance session for the job's project, advance to the next step.
     */
    async onJobComplete(jobId: string, outcome: "success" | "failure"): Promise<void> {
      const job = await db.query.jobsTable.findFirst({
        where: eq(jobsTable.id, jobId),
      });

      if (!job?.projectId) {
        return;
      }

      const session = await getSession(job.projectId);

      if (!session || session.status !== "running") {
        return;
      }

      const project = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, job.projectId),
      });

      if (!project) {
        return;
      }

      if (outcome === "failure") {
        await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "paused",
            pausedReason: "job_failed",
            pausedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, session.id));

        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

      // Success — advance to next step
      await advanceStep(project.ownerUserId, job.projectId, session.id);
      await publishSessionUpdate(project.ownerUserId, job.projectId);
    },
  };
};

export type AutoAdvanceService = ReturnType<typeof createAutoAdvanceService>;
