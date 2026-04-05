import { and, eq, gte, inArray, sql } from "drizzle-orm";

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
  milestonesTable,
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
import type { TaskPlanningService } from "./task-planning-service.js";
import type { SandboxService } from "./sandbox-service.js";
import type { UserFlowService } from "./user-flow-service.js";

type AutoAdvanceSessionRow = typeof autoAdvanceSessionsTable.$inferSelect;

type AutoAdvanceJobInputs = Record<string, unknown> & {
  _autoAdvance?: {
    batchToken: string;
    sessionId: string;
    retryAttempt?: number;
  };
};

type JobFailurePayload = {
  message?: string;
  code?: string;
  hint?: string;
  retryable?: boolean;
};

type ReconciliationIssue = {
  action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
  hint: string;
};

type MilestoneMapIssue = {
  action: "rewrite_milestone_map" | "append_milestones" | "needs_human_review";
  hint: string;
};

type MilestoneDeliveryIssue = {
  action: "refresh_artifacts" | "needs_human_review";
  hint: string;
};

const MAX_MILESTONE_REPAIR_ATTEMPTS = 3;

const toSession = (row: AutoAdvanceSessionRow): AutoAdvanceSession => ({
  id: row.id,
  projectId: row.projectId,
  status: row.status,
  currentStep: row.currentStep ?? null,
  pausedReason: row.pausedReason ?? null,
  autoApproveWhenClear: row.autoApproveWhenClear,
  skipReviewSteps: row.skipReviewSteps,
  skipHumanReview: row.skipHumanReview,
  autoRepairMilestoneCoverage: row.autoRepairMilestoneCoverage,
  creativityMode: (row.creativityMode ?? "balanced") as AutoAdvanceSession["creativityMode"],
  retryCount: row.retryCount ?? 0,
  reviewCount: row.reviewCount ?? 0,
  milestoneRepairCount: row.milestoneRepairCount ?? 0,
  ciFixCount: row.ciFixCount ?? 0,
  ciWaitWindowCount: row.ciWaitWindowCount ?? 0,
  maxConcurrentJobs: row.maxConcurrentJobs ?? 1,
  startedAt: row.startedAt?.toISOString() ?? null,
  pausedAt: row.pausedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const isRetryableJobFailure = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const payload = error as JobFailurePayload;

  if (typeof payload.retryable === "boolean") {
    return payload.retryable;
  }

  if (typeof payload.code === "string") {
    if (
      payload.code === "decision_conflict_unresolved" ||
      payload.code.startsWith("llm_output_")
    ) {
      return false;
    }
  }

  const message = typeof payload.message === "string" ? payload.message.toLowerCase() : "";

  if (
    message.includes("validatedecisionconsistency found conflicts") ||
    message.includes("prompt too long") ||
    message.includes("context length") ||
    message.includes("exceeded max context length")
  ) {
    return false;
  }

  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("500") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("429")
  );
};

const parseStoredReconciliationIssues = (value: unknown): ReconciliationIssue[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (issue): issue is ReconciliationIssue =>
      !!issue &&
      typeof issue === "object" &&
      (issue.action === "rewrite_feature_set" ||
        issue.action === "create_catch_up_feature" ||
        issue.action === "needs_human_review") &&
      typeof issue.hint === "string" &&
      issue.hint.trim().length > 0,
  );
};

const parseStoredMapIssues = (value: unknown): MilestoneMapIssue[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (issue): issue is MilestoneMapIssue =>
      !!issue &&
      typeof issue === "object" &&
      (issue.action === "rewrite_milestone_map" ||
        issue.action === "append_milestones" ||
        issue.action === "needs_human_review") &&
      typeof issue.hint === "string" &&
      issue.hint.trim().length > 0,
  );
};

const parseStoredDeliveryIssues = (value: unknown): MilestoneDeliveryIssue[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (issue): issue is MilestoneDeliveryIssue =>
      !!issue &&
      typeof issue === "object" &&
      (issue.action === "refresh_artifacts" || issue.action === "needs_human_review") &&
      typeof issue.hint === "string" &&
      issue.hint.trim().length > 0,
  );
};

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
  milestone_map_review: { type: "ReviewMilestoneMap" },
  milestone_map_resolve: null,
  milestone_design_generate: {
    type: "GenerateMilestoneDesign",
    buildInputs: (href) => {
      const match = href.match(/\/milestones\/([^/]+)/);
      return { milestoneId: match?.[1] ?? "" };
    },
  },
  milestones_approve: null,
  milestone_scope_review: {
    type: "ReviewMilestoneScope",
    buildInputs: (href) => {
      const match = href.match(/\/milestones\/([^/?]+)/);
      return { milestoneId: match?.[1] ?? "" };
    },
  },
  milestone_scope_resolve: null,
  milestone_delivery_review: {
    type: "ReviewMilestoneDelivery",
    buildInputs: (href) => {
      const match = href.match(/\/milestones\/([^/?]+)/);
      return { milestoneId: match?.[1] ?? "" };
    },
  },
  milestone_ci_gate: {
    type: "WaitForMilestoneCi",
    buildInputs: (href) => {
      const match = href.match(/\/milestones\/([^/?]+)/);
      return { milestoneId: match?.[1] ?? "" };
    },
  },
  milestone_delivery_resolve: null,
  milestone_complete: null,
  features_create: {
    type: "GenerateMilestoneFeatureSet",
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
  feature_task_clarifications_generate: {
    type: "GenerateTaskClarifications",
    buildInputs: (href) => {
      const featureIdMatch = href.match(/\/features\/([^/?]+)/);
      const sessionMatch = href.match(/[?&]taskSession=([^&]+)/);
      return {
        featureId: featureIdMatch?.[1] ?? "",
        sessionId: sessionMatch?.[1] === "missing" ? "" : sessionMatch?.[1] ?? "",
      };
    },
  },
  feature_task_clarifications_answer: {
    type: "AutoAnswerTaskClarifications",
    buildInputs: (href) => {
      const featureIdMatch = href.match(/\/features\/([^/?]+)/);
      const sessionMatch = href.match(/[?&]taskSession=([^&]+)/);
      return {
        featureId: featureIdMatch?.[1] ?? "",
        sessionId: sessionMatch?.[1] ?? "",
      };
    },
  },
  feature_task_list_generate: {
    type: "GenerateFeatureTaskList",
    buildInputs: (href) => {
      const featureIdMatch = href.match(/\/features\/([^/?]+)/);
      const sessionMatch = href.match(/[?&]taskSession=([^&]+)/);
      return {
        featureId: featureIdMatch?.[1] ?? "",
        sessionId: sessionMatch?.[1] ?? "",
      };
    },
  },
  feature_implement: null,
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
  taskPlanningService: TaskPlanningService,
  sandboxService?: SandboxService,
) => {
  void sandboxService;
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
    const session = await db.query.autoAdvanceSessionsTable.findFirst({
      where: eq(autoAdvanceSessionsTable.projectId, projectId),
    });

    return session ?? null;
  };

  const getProjectMilestone = async (projectId: string, milestoneId: string) =>
    db.query.milestonesTable.findFirst({
      where: and(
        eq(milestonesTable.id, milestoneId),
        eq(milestonesTable.projectId, projectId),
      ),
    });

  const findActiveAutoAdvanceJob = async (
    projectId: string,
    sessionId: string,
    batchToken: string | null,
  ) => {
    if (!batchToken) {
      return null;
    }

    const [job] = await db.query.jobsTable.findMany({
      where: and(
        eq(jobsTable.projectId, projectId),
        inArray(jobsTable.status, ["queued", "running"]),
        sql`${jobsTable.inputs} -> '_autoAdvance' ->> 'sessionId' = ${sessionId}`,
        sql`${jobsTable.inputs} -> '_autoAdvance' ->> 'batchToken' = ${batchToken}`,
      ),
      limit: 1,
    });

    return job ?? null;
  };

  const findBatchAutoAdvanceJobs = async (
    projectId: string,
    sessionId: string,
    batchToken: string | null,
  ) => {
    if (!batchToken) {
      return [];
    }

    return db.query.jobsTable.findMany({
      where: and(
        eq(jobsTable.projectId, projectId),
        sql`${jobsTable.inputs} -> '_autoAdvance' ->> 'sessionId' = ${sessionId}`,
        sql`${jobsTable.inputs} -> '_autoAdvance' ->> 'batchToken' = ${batchToken}`,
      ),
    });
  };

  const publishSessionUpdate = async (ownerUserId: string, projectId: string) => {
    sseHub.publish(ownerUserId, "auto-advance:updated", { projectId });
  };

  const buildAutoAdvanceInputs = (
    inputs: Record<string, unknown>,
    sessionId: string,
    batchToken: string,
    retryAttempt?: number,
  ): AutoAdvanceJobInputs => ({
    ...inputs,
    _autoAdvance: {
      sessionId,
      batchToken,
      ...(retryAttempt !== undefined ? { retryAttempt } : {}),
    },
  });

  const stripAutoAdvanceInputs = (inputs: Record<string, unknown> | null | undefined) => {
    if (!inputs) {
      return {};
    }

    const { _autoAdvance: _ignored, ...rest } = inputs as AutoAdvanceJobInputs;
    return rest;
  };

  const queueRepairJob = async (input: {
    ownerUserId: string;
    projectId: string;
    sessionId: string;
    repairCount: number;
    currentStep: string;
    jobType: string;
    jobInputs: Record<string, unknown>;
  }) => {
    const batchToken = generateId();

    await db
      .update(autoAdvanceSessionsTable)
      .set({
        currentStep: input.currentStep,
        milestoneRepairCount: input.repairCount,
        pendingJobCount: 1,
        activeBatchToken: batchToken,
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, input.sessionId));

    await jobService.createJob({
      createdByUserId: input.ownerUserId,
      projectId: input.projectId,
      type: input.jobType,
      inputs: buildAutoAdvanceInputs(
        {
          ...input.jobInputs,
          attemptNumber: input.repairCount,
        },
        input.sessionId,
        batchToken,
      ),
    });
  };

  const tryQueueStoredMilestoneScopeRepair = async (
    ownerUserId: string,
    projectId: string,
    sessionId: string,
    session: AutoAdvanceSessionRow,
    currentStep: string,
  ) => {
    if (!session.autoRepairMilestoneCoverage) {
      return false;
    }

    const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);

    if (
      !activeMilestone ||
      (((activeMilestone as typeof activeMilestone & {
        reconciliationStatus?: string;
      }).scopeReviewStatus ??
        (activeMilestone as typeof activeMilestone & {
          reconciliationStatus?: string;
        }).reconciliationStatus) !== "failed_needs_human" &&
        ((activeMilestone as typeof activeMilestone & {
          reconciliationStatus?: string;
        }).scopeReviewStatus ??
          (activeMilestone as typeof activeMilestone & {
            reconciliationStatus?: string;
          }).reconciliationStatus) !== "failed_first_pass")
    ) {
      return false;
    }

    const storedIssues = parseStoredReconciliationIssues(
      (activeMilestone as typeof activeMilestone & { reconciliationIssues?: unknown }).scopeReviewIssues ??
        (activeMilestone as typeof activeMilestone & { reconciliationIssues?: unknown })
          .reconciliationIssues,
    );
    if (storedIssues.length === 0) {
      return false;
    }

    const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;
    if (nextRepairCount > MAX_MILESTONE_REPAIR_ATTEMPTS) {
      return false;
    }

    const hasStructuralIssues = storedIssues.some(
      (issue) =>
        issue.action === "rewrite_feature_set" || issue.action === "create_catch_up_feature",
    );

    await queueRepairJob({
      ownerUserId,
      projectId,
      sessionId,
      repairCount: nextRepairCount,
      currentStep,
      jobType:
        currentStep === "milestone_reconciliation_resolve" && !hasStructuralIssues
          ? "ResolveMilestoneCoverageIssues"
          : "RewriteMilestoneFeatureSet",
      jobInputs: {
        milestoneId: activeMilestone.id,
        issues: storedIssues,
      },
    });

    return true;
  };

  const tryQueueStoredMilestoneDeliveryRepair = async (
    ownerUserId: string,
    projectId: string,
    sessionId: string,
    session: AutoAdvanceSessionRow,
    currentStep: string,
  ) => {
    if (!session.autoRepairMilestoneCoverage) {
      return false;
    }

    const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);

    if (
      !activeMilestone ||
      (activeMilestone.deliveryReviewStatus !== "failed_needs_human" &&
        activeMilestone.deliveryReviewStatus !== "failed_first_pass")
    ) {
      return false;
    }

    const storedIssues = parseStoredDeliveryIssues(activeMilestone.deliveryReviewIssues);
    if (storedIssues.length === 0) {
      return false;
    }

    const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;
    if (nextRepairCount > MAX_MILESTONE_REPAIR_ATTEMPTS) {
      return false;
    }

    await queueRepairJob({
      ownerUserId,
      projectId,
      sessionId,
      repairCount: nextRepairCount,
      currentStep,
      jobType: "ResolveMilestoneDeliveryIssues",
      jobInputs: {
        milestoneId: activeMilestone.id,
        issues: storedIssues,
      },
    });

    return true;
  };

  const tryQueueStoredMilestoneMapRepair = async (
    ownerUserId: string,
    projectId: string,
    sessionId: string,
    session: AutoAdvanceSessionRow,
    currentStep: string,
  ) => {
    if (!session.autoRepairMilestoneCoverage) {
      return false;
    }

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });

    if (
      !project ||
      (project.milestoneMapReviewStatus !== "failed_needs_human" &&
        project.milestoneMapReviewStatus !== "failed_first_pass")
    ) {
      return false;
    }

    const storedIssues = parseStoredMapIssues(project.milestoneMapReviewIssues);
    if (storedIssues.length === 0) {
      return false;
    }

    if (storedIssues.some((issue) => issue.action === "needs_human_review")) {
      return false;
    }

    const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;
    if (nextRepairCount > MAX_MILESTONE_REPAIR_ATTEMPTS) {
      return false;
    }

    const hasRewriteIssue = storedIssues.some((issue) => issue.action === "rewrite_milestone_map");
    const hasAppendIssue = storedIssues.some((issue) => issue.action === "append_milestones");

    if (hasRewriteIssue && hasAppendIssue) {
      return false;
    }

    if (hasRewriteIssue) {
      const state = await milestoneService.getMilestoneMapMutationState(projectId);
      if (state.replacementLocked) {
        return false;
      }
    }

    await queueRepairJob({
      ownerUserId,
      projectId,
      sessionId,
      repairCount: nextRepairCount,
      currentStep,
      jobType: hasAppendIssue ? "AppendMilestones" : "RewriteMilestoneMap",
      jobInputs: {
        issues: storedIssues,
      },
    });

    return true;
  };

  const skipHumanReviewGate = async (input: {
    ownerUserId: string;
    projectId: string;
    sessionId: string;
    stepKey:
      | "milestone_map_resolve"
      | "milestone_scope_resolve"
      | "milestone_reconciliation_resolve"
      | "milestone_delivery_resolve";
  }) => {
    if (input.stepKey === "milestone_map_resolve") {
      await milestoneService.invalidateMapReview(input.projectId);
    } else {
      const activeMilestone = await milestoneService.getActiveMilestone(
        input.ownerUserId,
        input.projectId,
      );
      if (!activeMilestone) {
        return false;
      }

      if (
        input.stepKey === "milestone_scope_resolve" ||
        input.stepKey === "milestone_reconciliation_resolve"
      ) {
        await milestoneService.invalidateScopeReview(activeMilestone.id);
      } else {
        await milestoneService.invalidateDeliveryReview(activeMilestone.id);
      }
    }

    await db
      .update(autoAdvanceSessionsTable)
      .set({
        currentStep: input.stepKey,
        milestoneRepairCount: 0,
        activeBatchToken: null,
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, input.sessionId));

    return true;
  };

  const failSessionAfterAdvanceError = async (
    ownerUserId: string,
    projectId: string,
    sessionId: string,
    error: unknown,
  ) => {
    console.error("[auto-advance] Failed to advance session.", {
      projectId,
      sessionId,
      error,
    });

    await db
      .update(autoAdvanceSessionsTable)
      .set({
        status: "paused",
        pausedReason: "job_failed",
        pendingJobCount: 0,
        activeBatchToken: null,
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, sessionId));

    await publishSessionUpdate(ownerUserId, projectId);
  };

  const recordScopeReviewResult = async (input: {
    milestoneId: string;
    issues: ReconciliationIssue[];
    jobId: string;
    status: "passed" | "failed_first_pass" | "failed_needs_human";
  }) => {
    const scopedReviewMilestoneService = milestoneService as MilestoneService & {
      recordScopeReviewResult?: typeof milestoneService.recordReconciliationResult;
    };

    if (typeof scopedReviewMilestoneService.recordScopeReviewResult === "function") {
      await scopedReviewMilestoneService.recordScopeReviewResult(input);
      return;
    }

    await milestoneService.recordReconciliationResult(input);
  };

  const invalidateScopeReview = async (milestoneId: string) => {
    if ("invalidateScopeReview" in milestoneService) {
      await (
        milestoneService as MilestoneService & {
          invalidateScopeReview: (milestoneId: string) => Promise<unknown>;
        }
      ).invalidateScopeReview(milestoneId);
      return;
    }

    if ("invalidateReconciliation" in milestoneService) {
      await (
        milestoneService as MilestoneService & {
          invalidateReconciliation: (milestoneId: string) => Promise<unknown>;
        }
      ).invalidateReconciliation(milestoneId);
    }
  };

  const safelyAdvanceStep = async (
    ownerUserId: string,
    projectId: string,
    sessionId: string,
  ) => {
    try {
      await advanceStep(ownerUserId, projectId, sessionId);
    } catch (error) {
      await failSessionAfterAdvanceError(ownerUserId, projectId, sessionId, error);
      throw error;
    }
  };

  const extractFeatureIdFromHref = (href: string) => href.match(/[?&]featureId=([^&]+)/)?.[1] ?? null;

  const tryQueueImplementationRun = async (input: {
    ownerUserId: string;
    projectId: string;
    sessionId: string;
    stepKey: string;
    href: string;
  }) => {
    if (
      !sandboxService ||
      (input.stepKey !== "feature_implement" && input.stepKey !== "feature_stale_implementation")
    ) {
      return false;
    }

    const featureId = extractFeatureIdFromHref(input.href);
    if (!featureId) {
      console.warn(`[auto-advance] Could not extract featureId from href: ${input.href}`);
      return false;
    }

    const batchToken = generateId();
    await db
      .update(autoAdvanceSessionsTable)
      .set({
        currentStep: input.stepKey,
        pendingJobCount: 1,
        activeBatchToken: batchToken,
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, input.sessionId));

    await sandboxService.createRun(
      input.ownerUserId,
      input.projectId,
      { featureId, kind: "implement" },
      null,
      buildAutoAdvanceInputs({ featureId }, input.sessionId, batchToken),
    );

    return true;
  };

  const retryImplementationRun = async (input: {
    ownerUserId: string;
    projectId: string;
    sessionId: string;
    batchToken: string;
    featureId: string;
    retryAttempt: number;
    remaining: number;
  }) => {
    if (!sandboxService) {
      return false;
    }

    await db
      .update(autoAdvanceSessionsTable)
      .set({
        pendingJobCount: input.remaining + 1,
        retryCount: input.retryAttempt,
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, input.sessionId));

    await sandboxService.createRun(
      input.ownerUserId,
      input.projectId,
      { featureId: input.featureId, kind: "implement" },
      null,
      buildAutoAdvanceInputs(
        { featureId: input.featureId },
        input.sessionId,
        input.batchToken,
        input.retryAttempt,
      ),
    );

    return true;
  };

  const reconcileStaleRunningSession = async (
    ownerUserId: string,
    projectId: string,
    session: AutoAdvanceSessionRow | null,
  ) => {
    if (!session || session.status !== "running") {
      return session;
    }

    const activeJob = await findActiveAutoAdvanceJob(
      projectId,
      session.id,
      session.activeBatchToken ?? null,
    );

    if (activeJob) {
      return session;
    }

    const batchJobs = await findBatchAutoAdvanceJobs(
      projectId,
      session.id,
      session.activeBatchToken ?? null,
    );

    if (batchJobs.length > 0) {
      const hasUnfinishedJob = batchJobs.some(
        (job) => job.status === "queued" || job.status === "running",
      );
      if (hasUnfinishedJob) {
        return session;
      }

      const hasFailedJob = batchJobs.some(
        (job) => job.status === "failed" || job.status === "cancelled",
      );
      if (!hasFailedJob) {
        await db
          .update(autoAdvanceSessionsTable)
          .set({
            pendingJobCount: 0,
            activeBatchToken: null,
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, session.id));

        await safelyAdvanceStep(ownerUserId, projectId, session.id);
        await publishSessionUpdate(ownerUserId, projectId);
        return (await getSession(projectId)) ?? session;
      }
    }

    if (session.pendingJobCount <= 0 && !session.activeBatchToken) {
      return session;
    }

    const [updated] = await db
      .update(autoAdvanceSessionsTable)
      .set({
        status: "paused",
        pausedReason: "job_failed",
        pendingJobCount: 0,
        activeBatchToken: null,
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, session.id))
      .returning();

    await publishSessionUpdate(ownerUserId, projectId);
    return updated ?? session;
  };

  const requireSessionRow = (
    row: AutoAdvanceSessionRow | undefined,
    operation: string,
  ): AutoAdvanceSessionRow => {
    if (!row) {
      throw new Error(`Auto-advance session row missing after ${operation}.`);
    }

    return row;
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

    // skipReviewSteps: auto-select decision cards and auto-accept review gates.
    if (session.skipReviewSteps) {
      if (stepKey === "overview_approval") {
        await onePagerService.approveCanonical(ownerUserId, projectId);
        return true;
      }
      if (stepKey === "product_spec_approval") {
        await productSpecService.approveCanonical(ownerUserId, projectId);
        return true;
      }
      if (stepKey === "ux_decisions_select") {
        await autoSelectDecisionCards(ownerUserId, projectId, "ux");
        return true;
      }
      if (stepKey === "ux_decisions_accept") {
        await blueprintService.acceptDecisionDeck(ownerUserId, projectId, "ux");
        return true;
      }
      if (stepKey === "ux_spec_approval") {
        const blueprint = await blueprintService.getCanonicalByKind(ownerUserId, projectId, "ux");
        if (blueprint) {
          await artifactApprovalService.approve(ownerUserId, projectId, "blueprint_ux", blueprint.id);
          return true;
        }
      }
      if (stepKey === "tech_decisions_select") {
        await autoSelectDecisionCards(ownerUserId, projectId, "tech");
        return true;
      }
      if (stepKey === "tech_decisions_accept") {
        await blueprintService.acceptDecisionDeck(ownerUserId, projectId, "tech");
        return true;
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
        const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);
        if (activeMilestone?.status === "draft") {
          await milestoneService.transition(ownerUserId, activeMilestone.id, { action: "approve" });
          return true;
        }
        return false;
      }
      if (stepKey === "milestone_complete") {
        const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);
        if (activeMilestone?.status === "approved") {
          await milestoneService.transition(ownerUserId, activeMilestone.id, { action: "complete" });
          return true;
        }
        return false;
      }
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
        const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);
        if (activeMilestone?.status === "draft") {
          await milestoneService.transition(ownerUserId, activeMilestone.id, { action: "approve" });
          return true;
        }
        return false;
      }
      if (stepKey === "milestone_complete") {
        const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);
        if (activeMilestone?.status === "approved") {
          await milestoneService.transition(ownerUserId, activeMilestone.id, { action: "complete" });
          return true;
        }
        return false;
      }
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
    const MAX_AUTO_HANDLED_STEPS = 25;

    for (let autoHandledSteps = 0; autoHandledSteps < MAX_AUTO_HANDLED_STEPS; autoHandledSteps++) {
      const session = await getSession(projectId);
      const maxConcurrent = session?.maxConcurrentJobs ?? 1;
      const { actions } = await nextActionsService.buildBatch(ownerUserId, projectId, maxConcurrent);
      const nextAction = actions[0] ?? null;

      if (!nextAction) {
        const MAX_REVIEWS = 3;
        const currentReviewCount = session?.reviewCount ?? 0;

        if (currentReviewCount >= MAX_REVIEWS && session?.currentStep !== "delivery_review") {
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

        const batchToken = generateId();
        await db
          .update(autoAdvanceSessionsTable)
          .set({
            reviewCount: currentReviewCount + 1,
            currentStep: "delivery_review",
            pendingJobCount: 1,
            activeBatchToken: batchToken,
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, sessionId));

        await jobService.createJob({
          createdByUserId: ownerUserId,
          projectId,
          type: "ReviewDelivery",
          inputs: buildAutoAdvanceInputs({}, sessionId, batchToken),
        });
        return;
      }

      const stepConfig = AUTOMATABLE_STEPS[nextAction.key];

      if (stepConfig === undefined || stepConfig === null) {
        const queuedImplementationRun = await tryQueueImplementationRun({
          ownerUserId,
          projectId,
          sessionId,
          stepKey: nextAction.key,
          href: nextAction.href,
        });
        if (queuedImplementationRun) {
          return;
        }

        if (session) {
          if (
            nextAction.key === "milestone_reconciliation_resolve" ||
            nextAction.key === "milestone_map_resolve" ||
            nextAction.key === "milestone_scope_resolve" ||
            nextAction.key === "milestone_delivery_resolve"
          ) {
            const handledStoredRepair =
              nextAction.key === "milestone_map_resolve"
                ? await tryQueueStoredMilestoneMapRepair(
                    ownerUserId,
                    projectId,
                    sessionId,
                    session,
                    nextAction.key,
                  )
                : nextAction.key === "milestone_scope_resolve"
                  ? await tryQueueStoredMilestoneScopeRepair(
                      ownerUserId,
                      projectId,
                      sessionId,
                      session,
                      nextAction.key,
                    )
                  : nextAction.key === "milestone_reconciliation_resolve"
                    ? await tryQueueStoredMilestoneScopeRepair(
                        ownerUserId,
                        projectId,
                        sessionId,
                        session,
                        nextAction.key,
                      )
                  : await tryQueueStoredMilestoneDeliveryRepair(
                      ownerUserId,
                      projectId,
                      sessionId,
                      session,
                      nextAction.key,
                    );

            if (handledStoredRepair) {
              return;
            }

            if (
              session.autoRepairMilestoneCoverage &&
              (session.milestoneRepairCount ?? 0) >= MAX_MILESTONE_REPAIR_ATTEMPTS
            ) {
              await db
                .update(autoAdvanceSessionsTable)
                .set({
                  status: "paused",
                  currentStep: nextAction.key,
                  pausedReason:
                    nextAction.key === "milestone_map_resolve"
                      ? "milestone_map_repair_limit_reached"
                      : "milestone_repair_limit_reached",
                  pausedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(autoAdvanceSessionsTable.id, sessionId));
              return;
            }
          }

          const handled = await tryAutoHandle(
            ownerUserId,
            projectId,
            nextAction.key,
            nextAction.href,
            session,
          );

          if (handled) {
            await db
              .update(autoAdvanceSessionsTable)
              .set({ currentStep: nextAction.key, updatedAt: new Date() })
              .where(eq(autoAdvanceSessionsTable.id, sessionId));
            continue;
          }

          if (
            session.skipHumanReview &&
            (nextAction.key === "milestone_scope_resolve" ||
              nextAction.key === "milestone_reconciliation_resolve" ||
              nextAction.key === "milestone_delivery_resolve" ||
              nextAction.key === "milestone_map_resolve")
          ) {
            const skipped = await skipHumanReviewGate({
              ownerUserId,
              projectId,
              sessionId,
              stepKey: nextAction.key,
            });
            if (skipped) {
              continue;
            }
          }
        }

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

      const batchToken = generateId();
      await db
        .update(autoAdvanceSessionsTable)
        .set({
          currentStep: nextAction.key,
          pendingJobCount: actions.length,
          activeBatchToken: batchToken,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, sessionId));

      await Promise.all(
        actions.map(async (action) => {
          const cfg = AUTOMATABLE_STEPS[action.key];
          if (!cfg) return Promise.resolve();
          const inputs = cfg.buildInputs ? cfg.buildInputs(action.href) : {};
          if (action.key === "feature_task_clarifications_generate") {
            const taskInputs = inputs as { featureId?: string; sessionId?: string };
            if (taskInputs.featureId && !taskInputs.sessionId) {
              const planningSession = await taskPlanningService.getOrCreateSession(
                ownerUserId,
                taskInputs.featureId,
              );
              taskInputs.sessionId = planningSession.id;
            }
          }
          return jobService.createJob({
            createdByUserId: ownerUserId,
            projectId,
            type: cfg.type,
            inputs: buildAutoAdvanceInputs(inputs, sessionId, batchToken),
          });
        }),
      );
      return;
    }

    await db
      .update(autoAdvanceSessionsTable)
      .set({
        status: "paused",
        currentStep: "auto_handle_limit_reached",
        pausedReason: "needs_human",
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(autoAdvanceSessionsTable.id, sessionId));
  };

  return {
    async recoverRunningSessions() {
      const runningSessions = await db.query.autoAdvanceSessionsTable.findMany({
        where: eq(autoAdvanceSessionsTable.status, "running"),
      });

      for (const session of runningSessions) {
        const project = await db.query.projectsTable.findFirst({
          where: eq(projectsTable.id, session.projectId),
        });

        if (!project) {
          continue;
        }

        await reconcileStaleRunningSession(project.ownerUserId, session.projectId, session);
      }
    },

    async getStatus(ownerUserId: string, projectId: string): Promise<AutoAdvanceStatusResponse> {
      await requireProject(ownerUserId, projectId);

      const session = await reconcileStaleRunningSession(
        ownerUserId,
        projectId,
        await getSession(projectId),
      );
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

      const existing = await reconcileStaleRunningSession(
        ownerUserId,
        projectId,
        await getSession(projectId),
      );

      if (existing && existing.status === "running") {
        throw new HttpError(409, "session_already_running", "An auto-advance session is already running.");
      }

      const now = new Date();

      if (existing) {
        // Restart existing session
        const updated = requireSessionRow((await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "running",
            currentStep: null,
            pausedReason: null,
            autoApproveWhenClear: opts.autoApproveWhenClear ?? existing.autoApproveWhenClear,
            skipReviewSteps: opts.skipReviewSteps ?? existing.skipReviewSteps,
            skipHumanReview: opts.skipHumanReview ?? existing.skipHumanReview,
            autoRepairMilestoneCoverage:
              opts.autoRepairMilestoneCoverage ??
              existing.autoRepairMilestoneCoverage,
            creativityMode: opts.creativityMode ?? existing.creativityMode,
            maxConcurrentJobs: opts.maxConcurrentJobs ?? existing.maxConcurrentJobs,
            retryCount: 0,
            pendingJobCount: 0,
            activeBatchToken: null,
            milestoneRepairCount: 0,
            startedAt: now,
            pausedAt: null,
            completedAt: null,
            updatedAt: now,
          })
          .where(eq(autoAdvanceSessionsTable.id, existing.id))
          .returning())[0], "restart");

        await publishSessionUpdate(ownerUserId, projectId);
        await safelyAdvanceStep(ownerUserId, projectId, updated.id);
        await publishSessionUpdate(ownerUserId, projectId);
        return toSession(updated);
      }

      const created = requireSessionRow((await db
        .insert(autoAdvanceSessionsTable)
        .values({
          id: generateId(),
          projectId,
          status: "running",
          autoApproveWhenClear: opts.autoApproveWhenClear ?? false,
          skipReviewSteps: opts.skipReviewSteps ?? false,
          skipHumanReview: opts.skipHumanReview ?? false,
          autoRepairMilestoneCoverage:
            opts.autoRepairMilestoneCoverage ?? false,
          creativityMode: opts.creativityMode ?? "balanced",
          maxConcurrentJobs: opts.maxConcurrentJobs ?? 1,
          milestoneRepairCount: 0,
          pendingJobCount: 0,
          activeBatchToken: null,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning())[0], "create");

      await publishSessionUpdate(ownerUserId, projectId);
      await safelyAdvanceStep(ownerUserId, projectId, created.id);
      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(created);
    },

    async stop(ownerUserId: string, projectId: string): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await reconcileStaleRunningSession(
        ownerUserId,
        projectId,
        await getSession(projectId),
      );

      if (!session || session.status !== "running") {
        throw new HttpError(409, "session_not_running", "No running auto-advance session found.");
      }

      const updated = requireSessionRow((await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "paused",
          pausedReason: "manual_pause",
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning())[0], "stop");

      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(updated);
    },

    async resume(ownerUserId: string, projectId: string): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await reconcileStaleRunningSession(
        ownerUserId,
        projectId,
        await getSession(projectId),
      );

      if (!session || session.status !== "paused") {
        throw new HttpError(409, "session_not_paused", "No paused auto-advance session found.");
      }

      const updated = requireSessionRow((await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "running",
          pausedReason: null,
          pausedAt: null,
          activeBatchToken: null,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning())[0], "resume");

      await publishSessionUpdate(ownerUserId, projectId);
      await safelyAdvanceStep(ownerUserId, projectId, updated.id);
      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(updated);
    },

    async reset(ownerUserId: string, projectId: string): Promise<void> {
      await requireProject(ownerUserId, projectId);

      await reconcileStaleRunningSession(ownerUserId, projectId, await getSession(projectId));

      await jobService.cancelActiveAutoAdvanceJobsForProject({
        projectId,
        error: {
          code: "auto_advance_reset",
          message: "The auto-advance session was reset before this job finished.",
        },
      });

      await db
        .delete(autoAdvanceSessionsTable)
        .where(eq(autoAdvanceSessionsTable.projectId, projectId));

      await publishSessionUpdate(ownerUserId, projectId);
    },

    async step(ownerUserId: string, projectId: string): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await reconcileStaleRunningSession(
        ownerUserId,
        projectId,
        await getSession(projectId),
      );

      if (!session) {
        throw new HttpError(404, "session_not_found", "No auto-advance session exists for this project.");
      }

      if (session.status === "running") {
        throw new HttpError(409, "session_already_running", "Session is already running.");
      }

      const updated = requireSessionRow((await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "running",
          pausedReason: null,
          pausedAt: null,
          activeBatchToken: null,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning())[0], "step");

      await publishSessionUpdate(ownerUserId, projectId);
      await safelyAdvanceStep(ownerUserId, projectId, updated.id);
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

    async skipMilestoneReconciliation(
      ownerUserId: string,
      projectId: string,
    ): Promise<AutoAdvanceSession> {
      await requireProject(ownerUserId, projectId);

      const session = await reconcileStaleRunningSession(
        ownerUserId,
        projectId,
        await getSession(projectId),
      );

      if (!session || session.status !== "paused") {
        throw new HttpError(409, "session_not_paused", "No paused auto-advance session found.");
      }

      if (
        (session.currentStep !== "milestone_reconciliation_resolve" &&
          session.currentStep !== "milestone_scope_resolve" &&
          session.currentStep !== "milestone_delivery_resolve" &&
          session.currentStep !== "milestone_delivery_review") ||
        (session.pausedReason !== "milestone_repair_limit_reached" &&
          session.pausedReason !== "needs_human")
      ) {
        throw new HttpError(
          409,
          "not_milestone_reconciliation",
          "Session is not paused on milestone reconciliation.",
        );
      }

      const activeMilestone = await milestoneService.getActiveMilestone(ownerUserId, projectId);
      if (activeMilestone) {
        if (
          session.currentStep === "milestone_scope_resolve" ||
          session.currentStep === "milestone_reconciliation_resolve"
        ) {
          await milestoneService.invalidateScopeReview(activeMilestone.id);
        } else {
          await milestoneService.invalidateDeliveryReview(activeMilestone.id);
        }
      }

      const updated = requireSessionRow((await db
        .update(autoAdvanceSessionsTable)
        .set({
          status: "running",
          pausedReason: null,
          pausedAt: null,
          milestoneRepairCount: 0,
          activeBatchToken: null,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning())[0], "skipMilestoneReconciliation");

      await publishSessionUpdate(ownerUserId, projectId);
      await safelyAdvanceStep(ownerUserId, projectId, updated.id);
      await publishSessionUpdate(ownerUserId, projectId);
      return toSession(updated);
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

      const autoAdvanceMeta = (job.inputs as AutoAdvanceJobInputs | null)?._autoAdvance;
      if (!autoAdvanceMeta || autoAdvanceMeta.sessionId !== session.id) {
        return;
      }

      if (session.activeBatchToken !== autoAdvanceMeta.batchToken) {
        return;
      }

      const project = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, job.projectId),
      });

      if (!project) {
        return;
      }

      // Atomically decrement pendingJobCount and get the updated value.
      const afterDecrement = requireSessionRow((await db
        .update(autoAdvanceSessionsTable)
        .set({
          pendingJobCount: sql`greatest(0, ${autoAdvanceSessionsTable.pendingJobCount} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(autoAdvanceSessionsTable.id, session.id))
        .returning())[0], "decrement pending jobs");

      const remaining = afterDecrement?.pendingJobCount ?? 0;

      if (outcome === "failure") {
        const MAX_RETRIES = 3;
        const currentRetryCount = autoAdvanceMeta.retryAttempt ?? 0;
        const nextRetryCount = currentRetryCount + 1;
        const shouldRetry = isRetryableJobFailure(job.error);
        const shouldRetryImplementation = job.type === "ImplementChange";
        const errorCode =
          job.error && typeof job.error === "object" && typeof (job.error as JobFailurePayload).code === "string"
            ? (job.error as JobFailurePayload).code!
            : "";
        const retryHint =
          job.error && typeof job.error === "object" && typeof (job.error as JobFailurePayload).hint === "string"
            ? (job.error as JobFailurePayload).hint!.trim()
            : "";

        if (shouldRetryImplementation && nextRetryCount < MAX_RETRIES) {
          const retryInputs = stripAutoAdvanceInputs(
            job.inputs as Record<string, unknown> | null | undefined,
          ) as { featureId?: string };
          if (retryInputs.featureId) {
            await retryImplementationRun({
              ownerUserId: project.ownerUserId,
              projectId: job.projectId,
              sessionId: session.id,
              batchToken: autoAdvanceMeta.batchToken,
              featureId: retryInputs.featureId,
              retryAttempt: nextRetryCount,
              remaining,
            });
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }
        }

        if (shouldRetry && nextRetryCount < MAX_RETRIES) {
          // Retry the same failed job instead of inferring the next step from current state.
          // Some jobs can create draft artifacts before failing, which would otherwise
          // make advanceStep() land on a manual approval step and stall the session.
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              pendingJobCount: remaining + 1,
              retryCount: nextRetryCount,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await jobService.createJob({
            createdByUserId: project.ownerUserId,
            projectId: job.projectId,
            type: job.type,
            inputs: buildAutoAdvanceInputs(
              {
                ...stripAutoAdvanceInputs(job.inputs as Record<string, unknown> | null | undefined),
                ...(retryHint.length > 0 ? { hint: retryHint } : {}),
              },
              session.id,
              autoAdvanceMeta.batchToken,
              nextRetryCount,
            ),
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
        } else {
          // Non-retryable failure or retries exhausted — pause and reset count for next run.
          const pausedReason =
            job.type === "GenerateMilestoneDesign" &&
            shouldRetry &&
            errorCode.startsWith("llm_output_")
              ? "needs_human"
              : "job_failed";
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason,
              retryCount: 0,
              pausedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await publishSessionUpdate(project.ownerUserId, job.projectId);
        }
        return;
      }

      if ((session.retryCount ?? 0) > 0) {
        await db
          .update(autoAdvanceSessionsTable)
          .set({ retryCount: 0, updatedAt: new Date() })
          .where(eq(autoAdvanceSessionsTable.id, session.id));
      }

      // Success path — if other parallel jobs are still pending, wait for them.
      if (remaining > 0) {
        return;
      }

      if (job.type === "ReviewMilestoneMap") {
        const output = job.outputs as {
          complete: boolean;
          issues: MilestoneMapIssue[];
        } | null;

        if (!output || output.complete || !output.issues?.length) {
          await milestoneService.recordMapReviewResult({
            projectId: job.projectId,
            issues: [],
            jobId: job.id,
            status: "passed",
          });
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              milestoneRepairCount: 0,
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;
        const hasRewriteIssue = output.issues.some((issue) => issue.action === "rewrite_milestone_map");
        const hasAppendIssue = output.issues.some((issue) => issue.action === "append_milestones");
        const hasRepairIssue = hasRewriteIssue || hasAppendIssue;
        const hasHumanIssue = output.issues.some((issue) => issue.action === "needs_human_review");
        const replacementState = hasRewriteIssue
          ? await milestoneService.getMilestoneMapMutationState(job.projectId)
          : null;

        await milestoneService.recordMapReviewResult({
          projectId: job.projectId,
          issues: output.issues,
          jobId: job.id,
          status: hasRepairIssue ? "failed_first_pass" : "failed_needs_human",
        });

        if (
          session.autoRepairMilestoneCoverage &&
          hasRepairIssue &&
          !hasHumanIssue &&
          !(hasRewriteIssue && replacementState?.replacementLocked) &&
          nextRepairCount <= MAX_MILESTONE_REPAIR_ATTEMPTS
        ) {
          await queueRepairJob({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            repairCount: nextRepairCount,
            currentStep: "milestone_map_resolve",
            jobType: hasAppendIssue ? "AppendMilestones" : "RewriteMilestoneMap",
            jobInputs: { issues: output.issues },
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (session.skipHumanReview) {
          const skipped = await skipHumanReviewGate({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            stepKey: "milestone_map_resolve",
          });
          if (skipped) {
            await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }
        }

        await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "paused",
            pausedReason: session.autoRepairMilestoneCoverage && hasRepairIssue && !hasHumanIssue
              ? "milestone_map_repair_limit_reached"
              : "needs_human",
            pausedAt: new Date(),
            activeBatchToken: null,
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, session.id));

        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

      if (job.type === "ReviewMilestoneScope" || job.type === "ReviewMilestoneCoverage") {
        const output = job.outputs as {
          complete: boolean;
          milestoneId: string;
          issues: Array<{
            action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
            hint: string;
          }>;
        } | null;

        const milestoneId =
          ((job.inputs as { milestoneId?: string } | null | undefined)?.milestoneId ?? null);

        if (!milestoneId) {
          throw new Error(`${job.type} did not include a milestoneId.`);
        }

        const milestone = await getProjectMilestone(job.projectId, milestoneId);
        if (!milestone) {
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason: "job_failed",
              pausedAt: new Date(),
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (!output || output.complete || !output.issues?.length) {
          await recordScopeReviewResult({
            milestoneId,
            issues: [],
            jobId: job.id,
            status: "passed",
          });
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              milestoneRepairCount: 0,
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }
        const firstIssue = output.issues[0];

        if (!firstIssue) {
          await recordScopeReviewResult({
            milestoneId,
            issues: output.issues,
            jobId: job.id,
            status: "failed_needs_human",
          });
          if (session.skipHumanReview) {
            const skipped = await skipHumanReviewGate({
              ownerUserId: project.ownerUserId,
              projectId: job.projectId,
              sessionId: session.id,
              stepKey:
                job.type === "ReviewMilestoneCoverage"
                  ? "milestone_reconciliation_resolve"
                  : "milestone_scope_resolve",
            });
            if (skipped) {
              await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
              await publishSessionUpdate(project.ownerUserId, job.projectId);
              return;
            }
          }
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason: "needs_human",
              pausedAt: new Date(),
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;
        const hasStructuralIssues = output.issues.some(
          (issue) =>
            issue.action === "rewrite_feature_set" || issue.action === "create_catch_up_feature",
        );

        if (
          session.autoRepairMilestoneCoverage &&
          hasStructuralIssues &&
          nextRepairCount <= MAX_MILESTONE_REPAIR_ATTEMPTS
        ) {
          await recordScopeReviewResult({
            milestoneId,
            issues: output.issues,
            jobId: job.id,
            status: "failed_first_pass",
          });

          await queueRepairJob({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            repairCount: nextRepairCount,
            currentStep:
              job.type === "ReviewMilestoneCoverage"
                ? "milestone_reconciliation_resolve"
                : "milestone_scope_resolve",
            jobType: "RewriteMilestoneFeatureSet",
            jobInputs: {
              milestoneId,
              issues: output.issues,
            },
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (
          session.autoRepairMilestoneCoverage &&
          job.type === "ReviewMilestoneCoverage" &&
          nextRepairCount <= MAX_MILESTONE_REPAIR_ATTEMPTS
        ) {
          await recordScopeReviewResult({
            milestoneId,
            issues: output.issues,
            jobId: job.id,
            status: "failed_needs_human",
          });
          await queueRepairJob({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            repairCount: nextRepairCount,
            currentStep: "milestone_reconciliation_resolve",
            jobType: "ResolveMilestoneCoverageIssues",
            jobInputs: {
              milestoneId,
              issues: output.issues,
            },
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (session.skipHumanReview) {
          const skipped = await skipHumanReviewGate({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            stepKey:
              job.type === "ReviewMilestoneCoverage"
                ? "milestone_reconciliation_resolve"
                : "milestone_scope_resolve",
          });
          if (skipped) {
            await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }
        }

        await recordScopeReviewResult({
          milestoneId,
          issues: output.issues,
          jobId: job.id,
          status: "failed_needs_human",
        });
        await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "paused",
            pausedReason:
              session.autoRepairMilestoneCoverage &&
              (hasStructuralIssues || job.type === "ReviewMilestoneCoverage")
              ? "milestone_repair_limit_reached"
              : "needs_human",
            pausedAt: new Date(),
            activeBatchToken: null,
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, session.id));

        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

      if (job.type === "ReviewMilestoneDelivery") {
        const output = job.outputs as {
          complete: boolean;
          milestoneId: string;
          issues: MilestoneDeliveryIssue[];
        } | null;
        const milestoneId =
          ((job.inputs as { milestoneId?: string } | null | undefined)?.milestoneId ?? null);

        if (!milestoneId) {
          throw new Error("ReviewMilestoneDelivery did not include a milestoneId.");
        }

        if (!output || output.complete || !output.issues?.length) {
          await milestoneService.recordDeliveryReviewResult({
            milestoneId,
            issues: [],
            jobId: job.id,
            status: "passed",
          });
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              milestoneRepairCount: 0,
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;
        const hasRepairIssue = output.issues.some((issue) => issue.action === "refresh_artifacts");

        await milestoneService.recordDeliveryReviewResult({
          milestoneId,
          issues: output.issues,
          jobId: job.id,
          status: hasRepairIssue ? "failed_first_pass" : "failed_needs_human",
        });

        if (session.autoRepairMilestoneCoverage && hasRepairIssue && nextRepairCount <= MAX_MILESTONE_REPAIR_ATTEMPTS) {
          await queueRepairJob({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            repairCount: nextRepairCount,
            currentStep: "milestone_delivery_resolve",
            jobType: "ResolveMilestoneDeliveryIssues",
            jobInputs: {
              milestoneId,
              issues: output.issues,
            },
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (session.skipHumanReview) {
          const skipped = await skipHumanReviewGate({
            ownerUserId: project.ownerUserId,
            projectId: job.projectId,
            sessionId: session.id,
            stepKey: "milestone_delivery_resolve",
          });
          if (skipped) {
            await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }
        }

        await db
          .update(autoAdvanceSessionsTable)
          .set({
            status: "paused",
            pausedReason:
              session.autoRepairMilestoneCoverage && hasRepairIssue
                ? "milestone_repair_limit_reached"
                : "needs_human",
            pausedAt: new Date(),
            activeBatchToken: null,
            updatedAt: new Date(),
          })
          .where(eq(autoAdvanceSessionsTable.id, session.id));

        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

      if (job.type === "ResolveMilestoneDeliveryIssues" || job.type === "ResolveMilestoneCoverageIssues") {
        const output = job.outputs as {
          resolved?: boolean;
          unresolvedReasons?: string[];
        } | null;

        if (!output?.resolved) {
          const repairInputs = stripAutoAdvanceInputs(
            job.inputs as Record<string, unknown> | null | undefined,
          ) as {
            milestoneId?: string;
            issues?: MilestoneDeliveryIssue[];
          };
          const milestoneId = repairInputs.milestoneId ?? null;
          const issues =
            job.type === "ResolveMilestoneCoverageIssues"
              ? parseStoredReconciliationIssues(repairInputs.issues)
              : parseStoredDeliveryIssues(repairInputs.issues);
          const nextRepairCount = (session.milestoneRepairCount ?? 0) + 1;

          if (
            session.autoRepairMilestoneCoverage &&
            milestoneId &&
            issues.length > 0 &&
            nextRepairCount <= MAX_MILESTONE_REPAIR_ATTEMPTS
          ) {
            await queueRepairJob({
              ownerUserId: project.ownerUserId,
              projectId: job.projectId,
              sessionId: session.id,
              repairCount: nextRepairCount,
              currentStep:
                job.type === "ResolveMilestoneCoverageIssues"
                  ? "milestone_reconciliation_resolve"
                  : "milestone_delivery_resolve",
              jobType:
                job.type === "ResolveMilestoneCoverageIssues"
                  ? "ResolveMilestoneCoverageIssues"
                  : "ResolveMilestoneDeliveryIssues",
              jobInputs: {
                milestoneId,
                issues,
                previousUnresolvedReasons: output?.unresolvedReasons ?? [],
              },
            });
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }

          if (session.skipHumanReview) {
            const skipped = await skipHumanReviewGate({
              ownerUserId: project.ownerUserId,
              projectId: job.projectId,
              sessionId: session.id,
              stepKey:
                job.type === "ResolveMilestoneCoverageIssues"
                  ? "milestone_reconciliation_resolve"
                  : "milestone_delivery_resolve",
            });
            if (skipped) {
              await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
              await publishSessionUpdate(project.ownerUserId, job.projectId);
              return;
            }
          }

          await db
            .update(autoAdvanceSessionsTable)
            .set({
              status: "paused",
              pausedReason:
                session.autoRepairMilestoneCoverage &&
                issues.some((issue) => issue.action === "refresh_artifacts")
                  ? "milestone_repair_limit_reached"
                  : "needs_human",
              pausedAt: new Date(),
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (job.type === "ResolveMilestoneCoverageIssues") {
          const repairInputs = stripAutoAdvanceInputs(
            job.inputs as Record<string, unknown> | null | undefined,
          ) as { milestoneId?: string };
          let milestoneId = repairInputs.milestoneId ?? null;
          if (!milestoneId) {
            const nextActions = await nextActionsService.build(project.ownerUserId, job.projectId);
            const reviewHref =
              nextActions.actions.find((action) => action.key === "milestone_reconciliation_review")
                ?.href ?? null;
            milestoneId = reviewHref?.match(/\/milestones\/([^/?]+)/)?.[1] ?? null;
          }

          if (milestoneId) {
            await invalidateScopeReview(milestoneId);
            await db
              .update(autoAdvanceSessionsTable)
              .set({
                pendingJobCount: 1,
                activeBatchToken: autoAdvanceMeta.batchToken,
                updatedAt: new Date(),
              })
              .where(eq(autoAdvanceSessionsTable.id, session.id));
            await jobService.createJob({
              createdByUserId: project.ownerUserId,
              projectId: job.projectId,
              type: "ReviewMilestoneCoverage",
              inputs: buildAutoAdvanceInputs(
                { milestoneId },
                session.id,
                autoAdvanceMeta.batchToken,
              ),
            });
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }
        }

        await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

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
              activeBatchToken: null,
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
              activeBatchToken: null,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));

          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        // Enqueue the first (most critical) fix job with a hint.
        // Only GenerateUseCases, GenerateMilestones, and AppendMilestones are valid fix job types.
        const firstIssue = output.issues[0];
        if (
          firstIssue &&
          (firstIssue.jobType === "GenerateUseCases" ||
            firstIssue.jobType === "GenerateMilestones" ||
            firstIssue.jobType === "AppendMilestones")
        ) {
          const batchToken = generateId();
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              pendingJobCount: 1,
              activeBatchToken: batchToken,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await jobService.createJob({
            createdByUserId: project.ownerUserId,
            projectId: job.projectId,
            type: firstIssue.jobType,
            inputs: buildAutoAdvanceInputs(
              { hint: firstIssue.hint },
              session.id,
              batchToken,
            ),
          });
        }
        // The fix job will be picked up by the scheduler; onJobComplete will advance naturally after it runs.
        await publishSessionUpdate(project.ownerUserId, job.projectId);
        return;
      }

      if (job.type === "WaitForMilestoneCi") {
        const output = job.outputs as
          | {
              state?:
                | "passing"
                | "failing"
                | "pending"
                | "no_ci"
                | "pending_window_exhausted"
                | "stale_pending";
              milestoneId?: string;
            }
          | null;
        const milestoneId = output?.milestoneId;

        if (!milestoneId) {
          await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (output?.state === "passing" || output?.state === "no_ci") {
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              activeBatchToken: null,
              ciWaitWindowCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (output?.state === "pending_window_exhausted") {
          const nextWindowCount = (session.ciWaitWindowCount ?? 0) + 1;
          if (nextWindowCount >= 12) {
            await db
              .update(autoAdvanceSessionsTable)
              .set({
                status: "paused",
                pausedReason: "ci_wait_limit_reached",
                ciWaitWindowCount: nextWindowCount,
                pausedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(autoAdvanceSessionsTable.id, session.id));
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }

          const batchToken = generateId();
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              pendingJobCount: 1,
              activeBatchToken: batchToken,
              ciWaitWindowCount: nextWindowCount,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await jobService.createJob({
            createdByUserId: project.ownerUserId,
            projectId: job.projectId,
            type: "WaitForMilestoneCi",
            inputs: buildAutoAdvanceInputs({ milestoneId }, session.id, batchToken),
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }

        if (output?.state === "failing" || output?.state === "stale_pending") {
          const nextFixCount = (session.ciFixCount ?? 0) + 1;
          if (nextFixCount > 3) {
            await db
              .update(autoAdvanceSessionsTable)
              .set({
                status: "paused",
                pausedReason: "ci_fix_budget_exceeded",
                pausedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(autoAdvanceSessionsTable.id, session.id));
            await publishSessionUpdate(project.ownerUserId, job.projectId);
            return;
          }

          const batchToken = generateId();
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              pendingJobCount: 1,
              activeBatchToken: batchToken,
              ciFixCount: nextFixCount,
              ciWaitWindowCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await jobService.createJob({
            createdByUserId: project.ownerUserId,
            projectId: job.projectId,
            type: "RepairMilestoneCi",
            inputs: buildAutoAdvanceInputs(
              {
                milestoneId,
                diagnosis:
                  output.state === "stale_pending"
                    ? "pending_checks_stale"
                    : "failing_checks_detected",
              },
              session.id,
              batchToken,
            ),
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }
      }

      if (job.type === "RepairMilestoneCi") {
        const repairInputs = stripAutoAdvanceInputs(
          job.inputs as Record<string, unknown> | null | undefined,
        ) as { milestoneId?: string };
        if (repairInputs.milestoneId) {
          const batchToken = generateId();
          await db
            .update(autoAdvanceSessionsTable)
            .set({
              pendingJobCount: 1,
              activeBatchToken: batchToken,
              ciWaitWindowCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(autoAdvanceSessionsTable.id, session.id));
          await jobService.createJob({
            createdByUserId: project.ownerUserId,
            projectId: job.projectId,
            type: "WaitForMilestoneCi",
            inputs: buildAutoAdvanceInputs(
              { milestoneId: repairInputs.milestoneId },
              session.id,
              batchToken,
            ),
          });
          await publishSessionUpdate(project.ownerUserId, job.projectId);
          return;
        }
      }

      await safelyAdvanceStep(project.ownerUserId, job.projectId, session.id);
      await publishSessionUpdate(project.ownerUserId, job.projectId);
    },
  };
};

export type AutoAdvanceService = ReturnType<typeof createAutoAdvanceService>;
