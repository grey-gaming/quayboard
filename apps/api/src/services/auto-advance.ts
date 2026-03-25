import { and, eq, sql } from "drizzle-orm";

import type {
  AutoAdvanceSession,
  AutoAdvanceStatusResponse,
  BlueprintKind,
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
import type { ArtifactApprovalService } from "./artifact-approval-service.js";
import type { BlueprintService } from "./blueprint-service.js";
import type { FeatureWorkstreamService } from "./feature-workstream-service.js";
import type { MilestoneService } from "./milestone-service.js";
import type { OnePagerService } from "./one-pager-service.js";
import type { ProductSpecService } from "./product-spec-service.js";
import type { UserFlowService } from "./user-flow-service.js";

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
  retryCount: row.retryCount ?? 0,
  reviewCount: row.reviewCount ?? 0,
  maxConcurrentJobs: row.maxConcurrentJobs ?? 1,
  startedAt: row.startedAt?.toISOString() ?? null,
  pausedAt: row.pausedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Map of next-action keys that are automatable to their job types and input builders.
 * Returns null for steps that require human input (or auto-handling via session options).
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
  user_flows_generate: { type: "GenerateUseCases" },
  user_flows_approve: null,
  milestones_generate: { type: "GenerateMilestones" },
  milestone_design_generate: {
    type: "GenerateMilestoneDesign",
    buildInputs: (href) => {
      const match = href.match(/\/milestones\/([^/]+)/);
      return { milestoneId: match?.[1] ?? "" };
    },
  },
  milestones_approve: null,
  features_create: {
    type: "AppendFeatureFromOnePager",
    buildInputs: (href) => {
      const match = href.match(/[?&]milestone=([^&]+)/);
      return { milestoneId: match?.[1] ?? "" };
    },
  },
  feature_product_create: {
    type: "GenerateFeatureProductSpec",
    buildInputs: (href) => {
      const match = href.match(/\/features\/([^/]+)/);
      return { featureId: match?.[1] ?? "" };
    },
  },
  feature_product_approval: null,
  feature_ux_create: {
    type: "GenerateFeatureUxSpec",
    buildInputs: (href) => {
      const match = href.match(/\/features\/([^/]+)/);
      return { featureId: match?.[1] ?? "" };
    },
  },
  feature_ux_approval: null,
  feature_tech_create: {
    type: "GenerateFeatureTechSpec",
    buildInputs: (href) => {
      const match = href.match(/\/features\/([^/]+)/);
      return { featureId: match?.[1] ?? "" };
    },
  },
  feature_tech_approval: null,
  feature_user_docs_create: {
    type: "GenerateFeatureUserDocs",
    buildInputs: (href) => {
      const match = href.match(/\/features\/([^/]+)/);
      return { featureId: match?.[1] ?? "" };
    },
  },
  feature_user_docs_approval: null,
  feature_arch_docs_create: {
    type: "GenerateFeatureArchDocs",
    buildInputs: (href) => {
      const match = href.match(/\/features\/([^/]+)/);
      return { featureId: match?.[1] ?? "" };
    },
  },
  feature_arch_docs_approval: null,
  feature_stale_implementation: null,
};

export const createAutoAdvanceService = (
  db: AppDatabase,
  nextActionsService: NextActionsService,
  jobService: JobService,
  sseHub: SseHub,
  artifactApprovalService: ArtifactApprovalService,
  blueprintService: BlueprintService,
  milestoneService: MilestoneService,
  onePagerService: OnePagerService,
  productSpecService: ProductSpecService,
  featureWorkstreamService: FeatureWorkstreamService,
  userFlowService: UserFlowService,
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
   * Auto-selects the recommended option for all unselected decision cards of the given kind.
   */
  const autoSelectDecisionCards = async (
    ownerUserId: string,
    projectId: string,
    kind: BlueprintKind,
  ) => {
    const { cards } = await blueprintService.listDecisionCards(ownerUserId, projectId, kind);
    const unselected = cards.filter((card) => !card.selectedOptionId && !card.customSelection);

    if (unselected.length > 0) {
      await blueprintService.updateDecisionCards(ownerUserId, projectId, kind, {
        cards: unselected.map((card) => ({
          id: card.id,
          selectedOptionId: card.recommendation.id,
        })),
      });
    }
  };

  /**
   * Attempt to automatically handle the given step using session options.
   * Returns true if the step was handled, false if it still needs human input.
   */
  const tryAutoHandle = async (
    ownerUserId: string,
    projectId: string,
    stepKey: string,
    stepHref: string,
    session: AutoAdvanceSessionRow,
  ): Promise<boolean> => {
    // skipReviewSteps: auto-select the recommended option and auto-accept decision tiles
    if (session.skipReviewSteps) {
      if (stepKey === "ux_decisions_select") {
        await autoSelectDecisionCards(ownerUserId, projectId, "ux");
        return true;
      }
      if (stepKey === "ux_decisions_accept") {
        await blueprintService.acceptDecisionDeck(ownerUserId, projectId, "ux");
        return true;
      }
      if (stepKey === "tech_decisions_select") {
        await autoSelectDecisionCards(ownerUserId, projectId, "tech");
        return true;
      }
      if (stepKey === "tech_decisions_accept") {
        await blueprintService.acceptDecisionDeck(ownerUserId, projectId, "tech");
        return true;
      }
    }

    // autoApproveWhenClear: auto-approve documents when the artifact is ready
    if (session.autoApproveWhenClear) {
      if (stepKey === "overview_approval") {
        await onePagerService.approveCanonical(ownerUserId, projectId);
        return true;
      }
      if (stepKey === "product_spec_approval") {
        await productSpecService.approveCanonical(ownerUserId, projectId);
        return true;
      }
      if (stepKey === "ux_spec_approval") {
        const blueprint = await blueprintService.getCanonicalByKind(ownerUserId, projectId, "ux");
        if (blueprint) {
          await artifactApprovalService.approve(ownerUserId, projectId, "blueprint_ux", blueprint.id);
          return true;
        }
      }
      if (stepKey === "tech_spec_approval") {
        const blueprint = await blueprintService.getCanonicalByKind(ownerUserId, projectId, "tech");
        if (blueprint) {
          await artifactApprovalService.approve(ownerUserId, projectId, "blueprint_tech", blueprint.id);
          return true;
        }
      }
      if (stepKey === "user_flows_approve") {
        const flowList = await userFlowService.list(ownerUserId, projectId);
        if (flowList.userFlows.length > 0) {
          await userFlowService.approve(ownerUserId, projectId, {
            acceptedWarnings: flowList.coverage.warnings,
          });
          return true;
        }
      }
      if (stepKey === "milestones_approve") {
        // Approve the first draft milestone that has a design doc
        const { milestones } = await milestoneService.list(ownerUserId, projectId);
        for (const milestone of milestones) {
          if (milestone.status === "draft") {
            try {
              await milestoneService.transition(ownerUserId, milestone.id, { action: "approve" });
              return true;
            } catch (error) {
              if (
                error instanceof HttpError &&
                (error.code === "milestone_design_doc_required" ||
                  error.code === "invalid_milestone_transition")
              ) {
                // Expected — this milestone isn't ready yet, try the next one.
                continue;
              }
              throw error;
            }
          }
        }
        return false;
      }
      const featureApprovalKinds: Array<{
        key: string;
        track: "product" | "ux" | "tech" | "userDocs" | "archDocs";
        kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs";
      }> = [
        { key: "feature_product_approval", track: "product", kind: "product" },
        { key: "feature_ux_approval", track: "ux", kind: "ux" },
        { key: "feature_tech_approval", track: "tech", kind: "tech" },
        { key: "feature_user_docs_approval", track: "userDocs", kind: "user_docs" },
        { key: "feature_arch_docs_approval", track: "archDocs", kind: "arch_docs" },
      ];
      for (const entry of featureApprovalKinds) {
        if (stepKey === entry.key) {
          const featureIdMatch = stepHref.match(/\/features\/([^/]+)/);
          const featureId = featureIdMatch?.[1];
          if (!featureId) {
            console.warn(`[auto-advance] Could not extract featureId from href: ${stepHref}`);
            break;
          }
          const tracks = await featureWorkstreamService.getTracks(ownerUserId, featureId);
          const trackData = tracks.tracks[entry.track];
          const headRevisionId = trackData.headRevision?.id;
          if (headRevisionId && trackData.status !== "approved") {
            await featureWorkstreamService.approveRevision(ownerUserId, featureId, entry.kind, headRevisionId);
            return true;
          }
          break;
        }
      }
    }

    return false;
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
    const session = await getSession(projectId);
    const maxConcurrent = session?.maxConcurrentJobs ?? 1;
    const { actions } = await nextActionsService.buildBatch(ownerUserId, projectId, maxConcurrent);
    const nextAction = actions[0] ?? null;

    if (!nextAction) {
      const MAX_REVIEWS = 3;
      const currentReviewCount = session?.reviewCount ?? 0;

      if (currentReviewCount >= MAX_REVIEWS) {
        // Already exhausted review cycles (session resumed by human after review_limit_reached) — complete now.
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

      // All workflow steps done — run a delivery review pass.
      await db
        .update(autoAdvanceSessionsTable)
        .set({
          reviewCount: currentReviewCount + 1,
          currentStep: "delivery_review",
          pendingJobCount: 1,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, sessionId));

      await jobService.createJob({
        createdByUserId: ownerUserId,
        projectId,
        type: "ReviewDelivery",
        inputs: {},
      });
      return;
    }

    const stepConfig = AUTOMATABLE_STEPS[nextAction.key];

    if (stepConfig === undefined || stepConfig === null) {
      // Try auto-handling via session options before pausing
      if (session) {
        const handled = await tryAutoHandle(
          ownerUserId,
          projectId,
          nextAction.key,
          nextAction.href,
          session,
        );

        if (handled) {
          // Record the step we just auto-handled, then continue
          await db
            .update(autoAdvanceSessionsTable)
            .set({ currentStep: nextAction.key, updatedAt: new Date() })
            .where(eq(autoAdvanceSessionsTable.id, sessionId));
          await advanceStep(ownerUserId, projectId, sessionId);
          return;
        }
      }

      // Not automatable and no session option handled it — pause for human
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

    // Update current step and enqueue job(s)
    await db
      .update(autoAdvanceSessionsTable)
      .set({
        currentStep: nextAction.key,
        pendingJobCount: actions.length,
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, sessionId));

    await Promise.all(
      actions.map((action) => {
        const cfg = AUTOMATABLE_STEPS[action.key];
        if (!cfg) return Promise.resolve();
        const inputs = cfg.buildInputs ? cfg.buildInputs(action.href) : {};
        return jobService.createJob({
          createdByUserId: ownerUserId,
          projectId,
          type: cfg.type,
          inputs,
        });
      }),
    );
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
            maxConcurrentJobs: opts.maxConcurrentJobs ?? existing.maxConcurrentJobs,
            retryCount: 0,
            pendingJobCount: 0,
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
          maxConcurrentJobs: opts.maxConcurrentJobs ?? 1,
          pendingJobCount: 0,
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

      // Atomically decrement pendingJobCount and get the updated value.
      const [afterDecrement] = await db
        .update(autoAdvanceSessionsTable)
        .set({
          pendingJobCount: sql`greatest(0, ${autoAdvanceSessionsTable.pendingJobCount} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning();

      const remaining = afterDecrement?.pendingJobCount ?? 0;

      if (outcome === "failure") {
        const MAX_RETRIES = 3;
        const currentRetryCount = session.retryCount ?? 0;

        if (remaining > 0) {
          // Other parallel jobs are still running — pause immediately so they don't trigger advancement.
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason: "job_failed",
              retryCount: 0,
              pausedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (currentRetryCount < MAX_RETRIES) {
          // Retry: increment count and re-advance (will re-enqueue the same step since artifact wasn't created).
          await db
            .update(autoAdvanceSessionsTable)
            .set({ retryCount: currentRetryCount + 1, updatedAt: new Date() })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await advanceStep(project.ownerUserId, job.projectId, session.id);
          await publishSessionUpdate(project.ownerUserId, job.projectId);
        } else {
          // Max retries exhausted — pause and reset count for next run.
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason: "job_failed",
              retryCount: 0,
              pausedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await publishSessionUpdate(project.ownerUserId, job.projectId);
        }
        return;
      }

      // Success path — if other parallel jobs are still pending, wait for them.
      if (remaining > 0) {
        return;
      }

      // All parallel jobs in the batch have completed — reset retryCount.
      await db
        .update(autoAdvanceSessionsTable)
        .set({ retryCount: 0, updatedAt: new Date() })
        .where(eq(autoAdvanceSessionsTable.id, session.id));

      // Special handling for the delivery review job.
      if (job.type === "ReviewDelivery") {
        const output = job.outputs as {
          complete: boolean;
          issues: Array<{ jobType: string; hint: string }>;
        } | null;

        if (!output || output.complete || !output.issues?.length) {
          // Review passed — mark session completed.
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "completed",
              currentStep: null,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        // Issues found — check review limit (reviewCount was already incremented in advanceStep).
        if ((session.reviewCount ?? 0) >= 3) {
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason: "review_limit_reached",
              pausedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        // Enqueue the first (most critical) fix job with a hint.
        // Only GenerateUseCases and GenerateMilestones are valid fix job types.
        const firstIssue = output.issues[0];
        if (firstIssue && (firstIssue.jobType === "GenerateUseCases" || firstIssue.jobType === "GenerateMilestones")) {
          await db
            .update(autoAdvanceSessionsTable)
            .set({ pendingJobCount: 1, updatedAt: new Date() })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await jobService.createJob({
            createdByUserId: project.ownerUserId,
            projectId: job.projectId,
            type: firstIssue.jobType,
            inputs: { hint: firstIssue.hint },
          });
        }
        // The fix job will be picked up by the scheduler; onJobComplete will advance naturally after it runs.
        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

      await advanceStep(project.ownerUserId, job.projectId, session.id);
      await publishSessionUpdate(project.ownerUserId, job.projectId);
    },
  };
};

export type AutoAdvanceService = ReturnType<typeof createAutoAdvanceService>;
