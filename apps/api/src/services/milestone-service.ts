import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  type ArtifactApproval,
  type MilestoneCiStatus,
  type PlanningReviewStatus,
  createMilestoneRequestSchema,
  milestoneActionRequestSchema,
  milestoneDesignDocListResponseSchema,
  milestoneDesignDocSchema,
  milestoneDeliveryReviewIssueSchema,
  milestoneMapReviewIssueSchema,
  milestoneReconciliationIssueSchema,
  milestoneListResponseSchema,
  milestoneSchema,
  milestoneScopeReviewIssueSchema,
  updateMilestoneRequestSchema,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  featureCasesTable,
  milestoneDesignDocsTable,
  milestoneUseCasesTable,
  milestonesTable,
  projectsTable,
  reposTable,
  useCasesTable,
} from "../db/schema.js";
import type { GithubService } from "./github-service.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import { buildMilestoneDeliveryBranchName } from "./milestone-delivery-branch.js";
import type { SecretService } from "./secret-service.js";

const toMilestoneDesignDoc = (
  record: typeof milestoneDesignDocsTable.$inferSelect,
  approval: ArtifactApproval | null,
) =>
  milestoneDesignDocSchema.parse({
    id: record.id,
    milestoneId: record.milestoneId,
    version: record.version,
    title: record.title,
    markdown: record.markdown,
    source: record.source,
    isCanonical: record.isCanonical,
    createdAt: record.createdAt.toISOString(),
    approval,
  });

const parseReconciliationIssues = (value: unknown) => {
  const parsed = Array.isArray(value) ? value : [];
  return parsed.map((issue) => milestoneReconciliationIssueSchema.parse(issue));
};

const parseMapReviewIssues = (value: unknown) => {
  const parsed = Array.isArray(value) ? value : [];
  return parsed.map((issue) => milestoneMapReviewIssueSchema.parse(issue));
};

const parseScopeReviewIssues = (value: unknown) => {
  const parsed = Array.isArray(value) ? value : [];
  return parsed.map((issue) => milestoneScopeReviewIssueSchema.parse(issue));
};

const parseDeliveryReviewIssues = (value: unknown) => {
  const parsed = Array.isArray(value) ? value : [];
  return parsed.map((issue) => milestoneDeliveryReviewIssueSchema.parse(issue));
};

const buildMilestoneRecord = (input: {
  activeMilestoneId: string | null;
  ciStatusByMilestone: Map<string, MilestoneCiStatus | null>;
  featureCountByMilestone: Map<string, number>;
  linksByMilestone: Map<string, Array<{ id: string; title: string }>>;
  milestone: typeof milestonesTable.$inferSelect;
}) =>
  milestoneSchema.parse({
    id: input.milestone.id,
    projectId: input.milestone.projectId,
    position: input.milestone.position,
    title: input.milestone.title,
    summary: input.milestone.summary,
    status: input.milestone.status,
    linkedUserFlows: input.linksByMilestone.get(input.milestone.id) ?? [],
    featureCount: input.featureCountByMilestone.get(input.milestone.id) ?? 0,
    isActive: input.milestone.id === input.activeMilestoneId,
    approvedAt: input.milestone.approvedAt?.toISOString() ?? null,
    completedAt: input.milestone.completedAt?.toISOString() ?? null,
    scopeReviewStatus: input.milestone.scopeReviewStatus,
    scopeReviewIssues: parseScopeReviewIssues(input.milestone.scopeReviewIssues),
    scopeReviewedAt: input.milestone.scopeReviewedAt?.toISOString() ?? null,
    deliveryReviewStatus: input.milestone.deliveryReviewStatus,
    deliveryReviewIssues: parseDeliveryReviewIssues(input.milestone.deliveryReviewIssues),
    deliveryReviewedAt: input.milestone.deliveryReviewedAt?.toISOString() ?? null,
    ciStatus: input.ciStatusByMilestone.get(input.milestone.id) ?? null,
    createdAt: input.milestone.createdAt.toISOString(),
    updatedAt: input.milestone.updatedAt.toISOString(),
  });

const loadMilestoneMapMutationState = async (
  executor: Pick<AppDatabase, "query">,
  projectId: string,
) => {
  const [existingMilestones, existingFeatures] = await Promise.all([
    executor.query.milestonesTable.findMany({
      where: eq(milestonesTable.projectId, projectId),
      orderBy: [asc(milestonesTable.position)],
    }),
    executor.query.featureCasesTable.findMany({
      where: and(
        eq(featureCasesTable.projectId, projectId),
        isNull(featureCasesTable.archivedAt),
      ),
    }),
  ]);

  const hasFeatures = existingFeatures.length > 0;
  const hasLockedMilestones = existingMilestones.some((milestone) => milestone.status !== "draft");

  return {
    existingMilestones,
    hasFeatures,
    hasLockedMilestones,
    replacementLocked: hasFeatures || hasLockedMilestones,
  };
};

export const createMilestoneService = (
  db: AppDatabase,
  githubService?: GithubService,
  secretService?: SecretService,
) => ({
  async getMilestoneCiStatus(
    ownerUserId: string,
    projectId: string,
    milestone: typeof milestonesTable.$inferSelect,
  ): Promise<MilestoneCiStatus | null> {
    if (!githubService || !secretService || milestone.status !== "approved") {
      return null;
    }

    const repo = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, projectId),
    });
    if (!repo?.owner || !repo.name) {
      return null;
    }

    const env = await secretService.buildSecretEnvMap(ownerUserId, projectId);
    if (!env.GITHUB_PAT) {
      return null;
    }

    const branchName = buildMilestoneDeliveryBranchName(milestone);
    const branchExists = await githubService.branchExists({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      branch: branchName,
    });

    if (!branchExists) {
      return null;
    }

    return githubService.getCommitCiStatus({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      ref: branchName,
    });
  },

  async assertOwnedProject(ownerUserId: string, projectId: string) {
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
  },

  async assertApprovedUserFlows(ownerUserId: string, projectId: string) {
    const project = await this.assertOwnedProject(ownerUserId, projectId);

    if (!project.userFlowsApprovedAt) {
      throw new HttpError(
        409,
        "user_flows_approval_required",
        "Approve the user flows before planning milestones or features.",
      );
    }

    return project;
  },

  async getContext(ownerUserId: string, milestoneId: string) {
    const [milestone] = await db
      .select({
        id: milestonesTable.id,
        projectId: milestonesTable.projectId,
        status: milestonesTable.status,
        ownerUserId: projectsTable.ownerUserId,
      })
      .from(milestonesTable)
      .innerJoin(projectsTable, eq(projectsTable.id, milestonesTable.projectId))
      .where(eq(milestonesTable.id, milestoneId))
      .limit(1);

    if (!milestone || milestone.ownerUserId !== ownerUserId) {
      throw new HttpError(404, "milestone_not_found", "Milestone not found.");
    }

    return milestone;
  },

  async getProjectMilestones(projectId: string) {
    return db.query.milestonesTable.findMany({
      where: eq(milestonesTable.projectId, projectId),
      orderBy: [asc(milestonesTable.position)],
    });
  },

  async getActiveMilestone(ownerUserId: string, projectId: string) {
    await this.assertApprovedUserFlows(ownerUserId, projectId);

    return db.query.milestonesTable.findFirst({
      where: and(
        eq(milestonesTable.projectId, projectId),
        inArray(milestonesTable.status, ["draft", "approved"]),
      ),
      orderBy: [asc(milestonesTable.position)],
    });
  },

  async assertActiveMilestone(ownerUserId: string, projectId: string, milestoneId: string) {
    const activeMilestone = await this.getActiveMilestone(ownerUserId, projectId);

    if (!activeMilestone || activeMilestone.id !== milestoneId) {
      throw new HttpError(
        409,
        "active_milestone_required",
        "Only the active milestone can be changed at this stage.",
      );
    }

    return activeMilestone;
  },

  async invalidateReconciliation(milestoneId: string) {
    return this.invalidateScopeReview(milestoneId);
  },

  async invalidateMapReview(projectId: string) {
    await db
      .update(projectsTable)
      .set({
        milestoneMapReviewStatus: "not_started",
        milestoneMapReviewIssues: [],
        milestoneMapReviewedAt: null,
        milestoneMapReviewLastJobId: null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId));
  },

  async recordMapReviewResult(input: {
    projectId: string;
    issues: Array<{
      action: "rewrite_milestone_map" | "append_milestones" | "needs_human_review";
      hint: string;
    }>;
    jobId: string;
    status: PlanningReviewStatus;
  }) {
    await db
      .update(projectsTable)
      .set({
        milestoneMapReviewStatus: input.status,
        milestoneMapReviewIssues: input.issues,
        milestoneMapReviewedAt: new Date(),
        milestoneMapReviewLastJobId: input.jobId,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, input.projectId));
  },

  async markMapGenerated(projectId: string) {
    await db
      .update(projectsTable)
      .set({
        milestoneMapGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId));
  },

  async invalidateScopeReview(milestoneId: string) {
    await db
      .update(milestonesTable)
      .set({
        scopeReviewStatus: "not_started",
        scopeReviewIssues: [],
        scopeReviewedAt: null,
        scopeReviewLastJobId: null,
        deliveryReviewStatus: "not_started",
        deliveryReviewIssues: [],
        deliveryReviewedAt: null,
        deliveryReviewLastJobId: null,
        reconciliationStatus: "not_started",
        reconciliationIssues: [],
        reconciliationReviewedAt: null,
        reconciliationLastJobId: null,
        updatedAt: new Date(),
      })
      .where(eq(milestonesTable.id, milestoneId));
  },

  async recordReconciliationResult(input: {
    milestoneId: string;
    issues: Array<{
      action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
      hint: string;
    }>;
    jobId: string;
    status: "passed" | "failed_first_pass" | "failed_needs_human";
  }) {
    return this.recordScopeReviewResult(input);
  },

  async recordScopeReviewResult(input: {
    milestoneId: string;
    issues: Array<{
      action: "rewrite_feature_set" | "create_catch_up_feature" | "needs_human_review";
      hint: string;
    }>;
    jobId: string;
    status: "passed" | "failed_first_pass" | "failed_needs_human";
  }) {
    await db
      .update(milestonesTable)
      .set({
        scopeReviewStatus: input.status,
        scopeReviewIssues: input.issues,
        scopeReviewedAt: new Date(),
        scopeReviewLastJobId: input.jobId,
        reconciliationStatus: input.status,
        reconciliationIssues: input.issues,
        reconciliationReviewedAt: new Date(),
        reconciliationLastJobId: input.jobId,
        updatedAt: new Date(),
      })
      .where(eq(milestonesTable.id, input.milestoneId));
  },

  async invalidateDeliveryReview(milestoneId: string) {
    await db
      .update(milestonesTable)
      .set({
        deliveryReviewStatus: "not_started",
        deliveryReviewIssues: [],
        deliveryReviewedAt: null,
        deliveryReviewLastJobId: null,
        updatedAt: new Date(),
      })
      .where(eq(milestonesTable.id, milestoneId));
  },

  async recordDeliveryReviewResult(input: {
    milestoneId: string;
    issues: Array<{
      action: "refresh_artifacts" | "needs_human_review";
      hint: string;
    }>;
    jobId: string;
    status: PlanningReviewStatus;
  }) {
    await db
      .update(milestonesTable)
      .set({
        deliveryReviewStatus: input.status,
        deliveryReviewIssues: input.issues,
        deliveryReviewedAt: new Date(),
        deliveryReviewLastJobId: input.jobId,
        updatedAt: new Date(),
      })
      .where(eq(milestonesTable.id, input.milestoneId));
  },

  async incrementAutoCatchUpCount(milestoneId: string) {
    const [updated] = await db
      .update(milestonesTable)
      .set({
        autoCatchUpCount: sql`${milestonesTable.autoCatchUpCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(milestonesTable.id, milestoneId))
      .returning();

    return updated;
  },

  async list(ownerUserId: string, projectId: string) {
    const project = await this.assertApprovedUserFlows(ownerUserId, projectId);

    const milestones = await this.getProjectMilestones(projectId);

    const milestoneIds = milestones.map((milestone) => milestone.id);
    const [links, activeFlows, activeFeatures] = await Promise.all([
      milestoneIds.length === 0
        ? []
        : db
            .select({
              milestoneId: milestoneUseCasesTable.milestoneId,
              useCaseId: useCasesTable.id,
              title: useCasesTable.title,
            })
            .from(milestoneUseCasesTable)
            .innerJoin(useCasesTable, eq(useCasesTable.id, milestoneUseCasesTable.useCaseId))
            .where(inArray(milestoneUseCasesTable.milestoneId, milestoneIds)),
      db.query.useCasesTable.findMany({
        where: and(
          eq(useCasesTable.projectId, projectId),
          isNull(useCasesTable.archivedAt),
        ),
      }),
      milestoneIds.length === 0
        ? []
        : db.query.featureCasesTable.findMany({
            where: and(
              inArray(featureCasesTable.milestoneId, milestoneIds),
              isNull(featureCasesTable.archivedAt),
            ),
          }),
    ]);

    const linksByMilestone = new Map<string, Array<{ id: string; title: string }>>();
    for (const link of links) {
      const existing = linksByMilestone.get(link.milestoneId) ?? [];
      existing.push({ id: link.useCaseId, title: link.title });
      linksByMilestone.set(link.milestoneId, existing);
    }

    const featureCountByMilestone = new Map<string, number>();
    for (const feature of activeFeatures) {
      featureCountByMilestone.set(
        feature.milestoneId,
        (featureCountByMilestone.get(feature.milestoneId) ?? 0) + 1,
      );
    }

    const coveredUserFlowIds = new Set(links.map((link) => link.useCaseId));
    const activeMilestoneId =
      milestones.find((milestone) => milestone.status !== "completed")?.id ?? null;
    const ciStatusByMilestone = new Map<string, MilestoneCiStatus | null>();
    const activeMilestone =
      milestones.find((milestone) => milestone.id === activeMilestoneId) ?? null;

    if (activeMilestone && activeMilestone.deliveryReviewStatus === "passed") {
      ciStatusByMilestone.set(
        activeMilestone.id,
        await this.getMilestoneCiStatus(ownerUserId, projectId, activeMilestone),
      );
    }

    return milestoneListResponseSchema.parse({
      milestones: milestones.map((milestone) =>
        buildMilestoneRecord({
          activeMilestoneId,
          ciStatusByMilestone,
          featureCountByMilestone,
          linksByMilestone,
          milestone,
        }),
      ),
      coverage: {
        approvedUserFlowCount: activeFlows.length,
        coveredUserFlowCount: coveredUserFlowIds.size,
        uncoveredUserFlowIds: activeFlows
          .map((flow) => flow.id)
          .filter((flowId) => !coveredUserFlowIds.has(flowId)),
      },
      mapReview: {
        generatedAt: project.milestoneMapGeneratedAt?.toISOString() ?? null,
        reviewStatus: project.milestoneMapReviewStatus,
        reviewIssues: parseMapReviewIssues(project.milestoneMapReviewIssues),
        reviewedAt: project.milestoneMapReviewedAt?.toISOString() ?? null,
      },
    });
  },

  async validateLinkedUseCases(projectId: string, useCaseIds: string[]) {
    const approvedFlows = await db.query.useCasesTable.findMany({
      where: and(
        eq(useCasesTable.projectId, projectId),
        inArray(useCasesTable.id, useCaseIds),
        isNull(useCasesTable.archivedAt),
      ),
    });

    if (approvedFlows.length !== useCaseIds.length) {
      throw new HttpError(
        400,
        "invalid_user_flows",
        "Every milestone must link active user flows from the same project.",
      );
    }

    return approvedFlows;
  },

  async create(
    ownerUserId: string,
    projectId: string,
    input: unknown,
    createdByJobId?: string,
  ) {
    await this.assertApprovedUserFlows(ownerUserId, projectId);
    const payload = createMilestoneRequestSchema.parse(input);
    await this.validateLinkedUseCases(projectId, payload.useCaseIds);

    const milestoneId = await db.transaction(async (tx) => {
      const latestMilestone = await tx.query.milestonesTable.findFirst({
        where: eq(milestonesTable.projectId, projectId),
        orderBy: [desc(milestonesTable.position)],
      });
      const now = new Date();
      const [milestone] = await tx
        .insert(milestonesTable)
        .values({
          id: generateId(),
          projectId,
          position: (latestMilestone?.position ?? 0) + 1,
          title: payload.title,
          summary: payload.summary,
          status: "draft",
          approvedAt: null,
          completedAt: null,
          scopeReviewStatus: "not_started",
          scopeReviewIssues: [],
          scopeReviewedAt: null,
          scopeReviewLastJobId: null,
          deliveryReviewStatus: "not_started",
          deliveryReviewIssues: [],
          deliveryReviewedAt: null,
          deliveryReviewLastJobId: null,
          reconciliationStatus: "not_started",
          reconciliationIssues: [],
          reconciliationReviewedAt: null,
          reconciliationLastJobId: null,
          autoCatchUpCount: 0,
          createdByJobId: createdByJobId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(milestoneUseCasesTable).values(
        payload.useCaseIds.map((useCaseId) => ({
          milestoneId: milestone.id,
          useCaseId,
          createdAt: now,
        })),
      );

      return milestone.id;
    });

    await this.invalidateMapReview(projectId);

    return this.list(ownerUserId, projectId).then((response) => {
      const milestone = response.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        throw new Error("Failed to load created milestone.");
      }
      return milestone;
    });
  },

  async getMilestoneMapMutationState(projectId: string) {
    return loadMilestoneMapMutationState(db, projectId);
  },

  async appendDraftMilestones(input: {
    ownerUserId: string;
    projectId: string;
    items: Array<{
      summary: string;
      title: string;
      useCaseIds: string[];
    }>;
    createdByJobId?: string;
  }) {
    await this.assertApprovedUserFlows(input.ownerUserId, input.projectId);

    for (const milestone of input.items) {
      await this.validateLinkedUseCases(input.projectId, milestone.useCaseIds);
    }

    await db.transaction(async (tx) => {
      const [state, activeFlows, existingLinks] = await Promise.all([
        loadMilestoneMapMutationState(tx, input.projectId),
        tx.query.useCasesTable.findMany({
          where: and(
            eq(useCasesTable.projectId, input.projectId),
            isNull(useCasesTable.archivedAt),
          ),
        }),
        tx
          .select({
            useCaseId: milestoneUseCasesTable.useCaseId,
          })
          .from(milestoneUseCasesTable)
          .innerJoin(milestonesTable, eq(milestonesTable.id, milestoneUseCasesTable.milestoneId))
          .where(eq(milestonesTable.projectId, input.projectId)),
      ]);

      const coveredUseCaseIds = new Set(existingLinks.map((link) => link.useCaseId));
      const uncoveredUseCaseIds = activeFlows
        .map((flow) => flow.id)
        .filter((flowId) => !coveredUseCaseIds.has(flowId));
      const uncoveredUseCaseIdSet = new Set(uncoveredUseCaseIds);
      const appendedUseCaseIds = input.items.flatMap((milestone) => milestone.useCaseIds);
      const uniqueAppendedUseCaseIds = new Set(appendedUseCaseIds);

      if (input.items.length === 0) {
        throw new HttpError(
          400,
          "milestone_append_invalid",
          "Appending milestones requires at least one new milestone.",
        );
      }

      if (!state.replacementLocked) {
        throw new HttpError(
          409,
          "milestone_map_unlocked",
          "Append-only milestone repair is only used after milestone replacement becomes locked.",
        );
      }

      if (uniqueAppendedUseCaseIds.size !== appendedUseCaseIds.length) {
        throw new HttpError(
          400,
          "milestone_append_invalid",
          "Each uncovered user flow can only be assigned to one appended milestone.",
        );
      }

      if (
        appendedUseCaseIds.some((useCaseId) => !uncoveredUseCaseIdSet.has(useCaseId)) ||
        uniqueAppendedUseCaseIds.size !== uncoveredUseCaseIds.length
      ) {
        throw new HttpError(
          400,
          "milestone_append_invalid",
          "Appended milestones must cover every uncovered user flow exactly once.",
        );
      }

      const now = new Date();
      let nextPosition = (state.existingMilestones.at(-1)?.position ?? 0) + 1;

      for (const milestone of input.items) {
        const milestoneId = generateId();
        await tx.insert(milestonesTable).values({
          id: milestoneId,
          projectId: input.projectId,
          position: nextPosition,
          title: milestone.title,
          summary: milestone.summary,
          status: "draft",
          approvedAt: null,
          completedAt: null,
          scopeReviewStatus: "not_started",
          scopeReviewIssues: [],
          scopeReviewedAt: null,
          scopeReviewLastJobId: null,
          deliveryReviewStatus: "not_started",
          deliveryReviewIssues: [],
          deliveryReviewedAt: null,
          deliveryReviewLastJobId: null,
          reconciliationStatus: "not_started",
          reconciliationIssues: [],
          reconciliationReviewedAt: null,
          reconciliationLastJobId: null,
          autoCatchUpCount: 0,
          createdByJobId: input.createdByJobId ?? null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(milestoneUseCasesTable).values(
          milestone.useCaseIds.map((useCaseId) => ({
            milestoneId,
            useCaseId,
            createdAt: now,
          })),
        );
        nextPosition += 1;
      }

      await tx
        .update(projectsTable)
        .set({
          milestoneMapGeneratedAt: now,
          milestoneMapReviewStatus: "not_started",
          milestoneMapReviewIssues: [],
          milestoneMapReviewedAt: null,
          milestoneMapReviewLastJobId: null,
          updatedAt: now,
        })
        .where(eq(projectsTable.id, input.projectId));
    });

    return this.list(input.ownerUserId, input.projectId);
  },

  async replaceDraftMilestoneMap(input: {
    ownerUserId: string;
    projectId: string;
    items: Array<{
      summary: string;
      title: string;
      useCaseIds: string[];
    }>;
    createdByJobId?: string;
  }) {
    await this.assertApprovedUserFlows(input.ownerUserId, input.projectId);

    for (const milestone of input.items) {
      await this.validateLinkedUseCases(input.projectId, milestone.useCaseIds);
    }

    await db.transaction(async (tx) => {
      const state = await loadMilestoneMapMutationState(tx, input.projectId);

      if (state.hasFeatures) {
        throw new HttpError(
          409,
          "milestone_map_locked",
          "The milestone map cannot be replaced after feature planning has started.",
        );
      }

      if (state.hasLockedMilestones) {
        throw new HttpError(
          409,
          "milestone_map_locked",
          "The milestone map cannot be replaced after milestone approval has started.",
        );
      }

      const milestoneIds = state.existingMilestones.map((milestone) => milestone.id);
      if (milestoneIds.length > 0) {
        await tx
          .delete(milestoneUseCasesTable)
          .where(inArray(milestoneUseCasesTable.milestoneId, milestoneIds));
        await tx
          .delete(milestoneDesignDocsTable)
          .where(inArray(milestoneDesignDocsTable.milestoneId, milestoneIds));
        await tx.delete(milestonesTable).where(eq(milestonesTable.projectId, input.projectId));
      }

      const now = new Date();
      for (const [index, milestone] of input.items.entries()) {
        const milestoneId = generateId();
        await tx.insert(milestonesTable).values({
          id: milestoneId,
          projectId: input.projectId,
          position: index + 1,
          title: milestone.title,
          summary: milestone.summary,
          status: "draft",
          approvedAt: null,
          completedAt: null,
          scopeReviewStatus: "not_started",
          scopeReviewIssues: [],
          scopeReviewedAt: null,
          scopeReviewLastJobId: null,
          deliveryReviewStatus: "not_started",
          deliveryReviewIssues: [],
          deliveryReviewedAt: null,
          deliveryReviewLastJobId: null,
          reconciliationStatus: "not_started",
          reconciliationIssues: [],
          reconciliationReviewedAt: null,
          reconciliationLastJobId: null,
          autoCatchUpCount: 0,
          createdByJobId: input.createdByJobId ?? null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(milestoneUseCasesTable).values(
          milestone.useCaseIds.map((useCaseId) => ({
            milestoneId,
            useCaseId,
            createdAt: now,
          })),
        );
      }

      await tx
        .update(projectsTable)
        .set({
          milestoneMapGeneratedAt: now,
          milestoneMapReviewStatus: "not_started",
          milestoneMapReviewIssues: [],
          milestoneMapReviewedAt: null,
          milestoneMapReviewLastJobId: null,
          updatedAt: now,
        })
        .where(eq(projectsTable.id, input.projectId));
    });

    return this.list(input.ownerUserId, input.projectId);
  },

  async update(ownerUserId: string, milestoneId: string, input: unknown) {
    const context = await this.getContext(ownerUserId, milestoneId);
    if (context.status !== "draft") {
      throw new HttpError(
        409,
        "milestone_locked",
        "Only draft milestones can be edited.",
      );
    }

    const payload = updateMilestoneRequestSchema.parse(input);
    if (payload.useCaseIds) {
      await this.validateLinkedUseCases(context.projectId, payload.useCaseIds);
    }

    await db.transaction(async (tx) => {
      if (payload.title || payload.summary) {
        const milestonePatch = {
          title: payload.title,
          summary: payload.summary,
          updatedAt: new Date(),
        };
        await tx
          .update(milestonesTable)
          .set(
            Object.fromEntries(
              Object.entries(milestonePatch).filter(([, value]) => value !== undefined),
            ),
          )
          .where(eq(milestonesTable.id, milestoneId));
      }

      if (payload.useCaseIds) {
        await tx.delete(milestoneUseCasesTable).where(eq(milestoneUseCasesTable.milestoneId, milestoneId));
        await tx.insert(milestoneUseCasesTable).values(
          payload.useCaseIds.map((useCaseId) => ({
            milestoneId,
            useCaseId,
            createdAt: new Date(),
          })),
        );
      }
    });

    await this.invalidateMapReview(context.projectId);

    return this.list(ownerUserId, context.projectId).then((response) => {
      const milestone = response.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        throw new Error("Failed to load updated milestone.");
      }
      return milestone;
    });
  },

  async mergeMilestoneDeliveryBranchIfNeeded(
    ownerUserId: string,
    projectId: string,
    milestone: typeof milestonesTable.$inferSelect,
  ) {
    if (!githubService || !secretService) {
      throw new Error("Milestone completion requires GitHub integration services.");
    }

    const repo = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, projectId),
    });

    if (!repo?.owner || !repo.name) {
      throw new HttpError(
        409,
        "project_repo_required",
        "A verified GitHub repository is required before completing the milestone.",
      );
    }

    const env = await secretService.buildSecretEnvMap(ownerUserId, projectId);
    if (!env.GITHUB_PAT) {
      throw new HttpError(
        409,
        "github_pat_required",
        "A configured GitHub PAT is required before completing the milestone.",
      );
    }

    const branchName = buildMilestoneDeliveryBranchName(milestone);
    const ciStatus = await githubService.getCommitCiStatus({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      ref: branchName,
    });
    if (ciStatus.state === "pending") {
      throw new HttpError(
        409,
        "milestone_ci_pending",
        "CI checks are still running for the milestone delivery branch.",
      );
    }
    if (ciStatus.state === "failing") {
      const summary = ciStatus.failures
        .slice(0, 3)
        .map((failure) => failure.name)
        .join(", ");
      throw new HttpError(
        409,
        "milestone_ci_failed",
        summary.length > 0
          ? `CI checks failed for the milestone delivery branch: ${summary}.`
          : "CI checks failed for the milestone delivery branch.",
      );
    }
    const pullRequest = await githubService.findOpenPullRequestForHead({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      head: branchName,
    });

    if (!pullRequest) {
      const branchExists = await githubService.branchExists({
        owner: repo.owner,
        repo: repo.name,
        token: env.GITHUB_PAT,
        branch: branchName,
      });

      if (branchExists) {
        throw new HttpError(
          409,
          "milestone_pull_request_required",
          "Open milestone pull request could not be found for the active delivery branch.",
        );
      }

      return;
    }

    try {
      await githubService.mergePullRequest({
        owner: repo.owner,
        repo: repo.name,
        token: env.GITHUB_PAT,
        pullNumber: pullRequest.number,
        method: "merge",
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "GitHub pull request merge failed.";
      throw new HttpError(409, "milestone_pull_request_merge_failed", message);
    }

    try {
      await githubService.deleteBranch({
        owner: repo.owner,
        repo: repo.name,
        token: env.GITHUB_PAT,
        branch: branchName,
      });
    } catch (error) {
      console.error("[milestone-service] Failed to delete merged milestone branch.", {
        projectId,
        milestoneId: milestone.id,
        branchName,
        error,
      });
    }
  },

  async transition(ownerUserId: string, milestoneId: string, input: unknown) {
    const context = await this.getContext(ownerUserId, milestoneId);
    await this.assertActiveMilestone(ownerUserId, context.projectId, milestoneId);
    const payload = milestoneActionRequestSchema.parse(input);
    const now = new Date();

    if (payload.action === "approve") {
      if (context.status !== "draft") {
        throw new HttpError(
          409,
          "invalid_milestone_transition",
          "Only draft milestones can be approved.",
        );
      }

      const project = await this.assertOwnedProject(ownerUserId, context.projectId);
      if (project.milestoneMapReviewStatus !== "passed") {
        throw new HttpError(
          409,
          "milestone_map_review_required",
          "Run the project milestone map review before approving the active milestone.",
        );
      }

      const designDoc = await this.getCanonicalDesignDoc(ownerUserId, milestoneId);
      if (!designDoc) {
        throw new HttpError(
          409,
          "milestone_design_doc_required",
          "Create a milestone design document before approving the milestone.",
        );
      }

      await db
        .update(milestonesTable)
        .set({
          status: "approved",
          approvedAt: now,
          completedAt: null,
          scopeReviewStatus: "not_started",
          scopeReviewIssues: [],
          scopeReviewedAt: null,
          scopeReviewLastJobId: null,
          deliveryReviewStatus: "not_started",
          deliveryReviewIssues: [],
          deliveryReviewedAt: null,
          deliveryReviewLastJobId: null,
          reconciliationStatus: "not_started",
          reconciliationIssues: [],
          reconciliationReviewedAt: null,
          reconciliationLastJobId: null,
          autoCatchUpCount: 0,
          updatedAt: now,
        })
        .where(eq(milestonesTable.id, milestoneId));
    } else {
      if (context.status !== "approved") {
        throw new HttpError(
          409,
          "invalid_milestone_transition",
          "Only approved milestones can be completed.",
        );
      }

      const milestone = await db.query.milestonesTable.findFirst({
        where: eq(milestonesTable.id, milestoneId),
      });

      if (milestone?.deliveryReviewStatus !== "passed") {
        throw new HttpError(
          409,
          "milestone_delivery_review_required",
          "Run the milestone delivery review and resolve all gaps before completing the milestone.",
        );
      }

      if (milestone) {
        await this.mergeMilestoneDeliveryBranchIfNeeded(
          ownerUserId,
          context.projectId,
          milestone,
        );
      }

      await db
        .update(milestonesTable)
        .set({
          status: "completed",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(milestonesTable.id, milestoneId));

      const remainingActiveMilestone = await db.query.milestonesTable.findFirst({
        where: and(
          eq(milestonesTable.projectId, context.projectId),
          inArray(milestonesTable.status, ["draft", "approved"]),
        ),
        orderBy: [asc(milestonesTable.position)],
      });

      if (!remainingActiveMilestone) {
        await this.invalidateMapReview(context.projectId);
      }
    }

    return this.list(ownerUserId, context.projectId).then((response) => {
      const milestone = response.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        throw new Error("Failed to load transitioned milestone.");
      }
      return milestone;
    });
  },

  async listDesignDocs(ownerUserId: string, milestoneId: string) {
    await this.getContext(ownerUserId, milestoneId);

    return db.query.milestoneDesignDocsTable.findMany({
      where: eq(milestoneDesignDocsTable.milestoneId, milestoneId),
      orderBy: [desc(milestoneDesignDocsTable.version)],
    });
  },

  async countMilestonesWithCanonicalDesignDocs(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const records = await db
      .selectDistinct({ milestoneId: milestoneDesignDocsTable.milestoneId })
      .from(milestoneDesignDocsTable)
      .innerJoin(milestonesTable, eq(milestonesTable.id, milestoneDesignDocsTable.milestoneId))
      .where(
        and(
          eq(milestonesTable.projectId, projectId),
          eq(milestoneDesignDocsTable.isCanonical, true),
        ),
      );

    return records.length;
  },

  async getCanonicalDesignDoc(ownerUserId: string, milestoneId: string) {
    await this.getContext(ownerUserId, milestoneId);

    return db.query.milestoneDesignDocsTable.findFirst({
      where: and(
        eq(milestoneDesignDocsTable.milestoneId, milestoneId),
        eq(milestoneDesignDocsTable.isCanonical, true),
      ),
    });
  },

  async assertCanonicalDesignDoc(
    ownerUserId: string,
    milestoneId: string,
    revisionId: string,
  ) {
    const designDoc = await this.getCanonicalDesignDoc(ownerUserId, milestoneId);
    if (!designDoc || designDoc.id !== revisionId) {
      throw new HttpError(
        409,
        "milestone_design_doc_not_canonical",
        "Only the canonical milestone design document can be approved.",
      );
    }

    return designDoc;
  },

  async createDesignDocVersion(input: {
    milestoneId: string;
    title: string;
    markdown: string;
    source: string;
    createdByJobId?: string | null;
  }) {
    return db.transaction(async (tx) => {
      const latest = await tx.query.milestoneDesignDocsTable.findFirst({
        where: eq(milestoneDesignDocsTable.milestoneId, input.milestoneId),
        orderBy: [desc(milestoneDesignDocsTable.version)],
      });

      await tx
        .update(milestoneDesignDocsTable)
        .set({ isCanonical: false })
        .where(eq(milestoneDesignDocsTable.milestoneId, input.milestoneId));

      const [created] = await tx
        .insert(milestoneDesignDocsTable)
        .values({
          id: generateId(),
          milestoneId: input.milestoneId,
          version: (latest?.version ?? 0) + 1,
          title: input.title,
          markdown: input.markdown,
          source: input.source,
          isCanonical: true,
          createdByJobId: input.createdByJobId ?? null,
          createdAt: new Date(),
        })
        .returning();

      await tx
        .update(milestonesTable)
        .set({
          scopeReviewStatus: "not_started",
          scopeReviewIssues: [],
          scopeReviewedAt: null,
          scopeReviewLastJobId: null,
          deliveryReviewStatus: "not_started",
          deliveryReviewIssues: [],
          deliveryReviewedAt: null,
          deliveryReviewLastJobId: null,
          reconciliationStatus: "not_started",
          reconciliationIssues: [],
          reconciliationReviewedAt: null,
          reconciliationLastJobId: null,
          updatedAt: new Date(),
        })
        .where(eq(milestonesTable.id, input.milestoneId));

      return created;
    });
  },

  async formatDesignDocList(
    ownerUserId: string,
    milestoneId: string,
    approvalsByDocId: Map<string, ArtifactApproval | null>,
  ) {
    const docs = await this.listDesignDocs(ownerUserId, milestoneId);

    return milestoneDesignDocListResponseSchema.parse({
      designDocs: docs.map((doc) =>
        toMilestoneDesignDoc(doc, approvalsByDocId.get(doc.id) ?? null),
      ),
    });
  },

});

export type MilestoneService = ReturnType<typeof createMilestoneService>;
