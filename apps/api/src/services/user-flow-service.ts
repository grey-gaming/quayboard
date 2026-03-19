import { and, eq, isNull } from "drizzle-orm";

import {
  approveUserFlowsRequestSchema,
  upsertUseCaseRequestSchema,
  useCaseSchema,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { projectsTable, useCasesTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const toUseCase = (record: typeof useCasesTable.$inferSelect) =>
  useCaseSchema.parse({
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    userStory: record.userStory,
    entryPoint: record.entryPoint,
    endState: record.endState,
    flowSteps: record.flowSteps,
    coverageTags: record.coverageTags,
    acceptanceCriteria: record.acceptanceCriteria,
    doneCriteriaRefs: record.doneCriteriaRefs,
    source: record.source,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

const buildCoverageWarnings = (flows: ReturnType<typeof toUseCase>[]) => {
  const warnings: string[] = [];
  const tags = new Set(flows.flatMap((flow) => flow.coverageTags));

  if (flows.length === 0) {
    warnings.push("Add at least one active user flow.");
  }

  if (!tags.has("happy-path")) {
    warnings.push("No user flow is tagged with happy-path coverage.");
  }

  if (!tags.has("onboarding")) {
    warnings.push("No user flow covers onboarding or first-use experience.");
  }

  return warnings;
};

export const createUserFlowService = (db: AppDatabase) => ({
  async clearApproval(projectId: string) {
    await db
      .update(projectsTable)
      .set({
        userFlowsApprovedAt: null,
        userFlowsApprovalSnapshot: null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId));
  },

  async getContext(ownerUserId: string, userFlowId: string) {
    const flow = await db
      .select({
        archivedAt: useCasesTable.archivedAt,
        ownerUserId: projectsTable.ownerUserId,
        projectId: useCasesTable.projectId,
      })
      .from(useCasesTable)
      .innerJoin(projectsTable, eq(projectsTable.id, useCasesTable.projectId))
      .where(eq(useCasesTable.id, userFlowId))
      .limit(1);

    if (
      !flow[0] ||
      flow[0].ownerUserId !== ownerUserId ||
      flow[0].archivedAt
    ) {
      throw new HttpError(404, "user_flow_not_found", "User flow not found.");
    }

    return {
      projectId: flow[0].projectId,
    };
  },

  async list(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    const flows = await db.query.useCasesTable.findMany({
      where: and(
        eq(useCasesTable.projectId, projectId),
        isNull(useCasesTable.archivedAt),
      ),
    });
    const parsed = flows.map(toUseCase);
    const acceptedWarnings =
      project.userFlowsApprovalSnapshot &&
      typeof project.userFlowsApprovalSnapshot === "object" &&
      "acceptedWarnings" in project.userFlowsApprovalSnapshot &&
      Array.isArray(project.userFlowsApprovalSnapshot.acceptedWarnings)
        ? (project.userFlowsApprovalSnapshot.acceptedWarnings as string[])
        : [];

    return {
      userFlows: parsed,
      coverage: {
        warnings: buildCoverageWarnings(parsed),
        acceptedWarnings,
      },
      approvedAt: project.userFlowsApprovedAt?.toISOString() ?? null,
    };
  },

  async create(ownerUserId: string, projectId: string, input: unknown) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    const payload = upsertUseCaseRequestSchema.parse(input);
    const now = new Date();
    const [created] = await db
      .insert(useCasesTable)
      .values({
        id: generateId(),
        projectId,
        title: payload.title,
        userStory: payload.userStory,
        entryPoint: payload.entryPoint,
        endState: payload.endState,
        flowSteps: payload.flowSteps,
        coverageTags: payload.coverageTags,
        acceptanceCriteria: payload.acceptanceCriteria,
        doneCriteriaRefs: payload.doneCriteriaRefs,
        source: payload.source,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await this.clearApproval(projectId);

    return toUseCase(created);
  },

  async update(ownerUserId: string, userFlowId: string, input: unknown) {
    const context = await this.getContext(ownerUserId, userFlowId);

    const payload = upsertUseCaseRequestSchema.parse(input);
    const [updated] = await db
      .update(useCasesTable)
      .set({
        title: payload.title,
        userStory: payload.userStory,
        entryPoint: payload.entryPoint,
        endState: payload.endState,
        flowSteps: payload.flowSteps,
        coverageTags: payload.coverageTags,
        acceptanceCriteria: payload.acceptanceCriteria,
        doneCriteriaRefs: payload.doneCriteriaRefs,
        source: payload.source,
        updatedAt: new Date(),
      })
      .where(eq(useCasesTable.id, userFlowId))
      .returning();

    await this.clearApproval(context.projectId);

    return toUseCase(updated);
  },

  async archive(ownerUserId: string, userFlowId: string) {
    const context = await this.getContext(ownerUserId, userFlowId);

    await db
      .update(useCasesTable)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(useCasesTable.id, userFlowId));

    await this.clearApproval(context.projectId);
  },

  async approve(ownerUserId: string, projectId: string, input: unknown) {
    const payload = approveUserFlowsRequestSchema.parse(input);
    const list = await this.list(ownerUserId, projectId);

    if (list.userFlows.length === 0) {
      throw new HttpError(
        409,
        "user_flows_required",
        "Add at least one active user flow before approval.",
      );
    }

    const unresolved = list.coverage.warnings.filter(
      (warning) => !payload.acceptedWarnings.includes(warning),
    );

    if (unresolved.length > 0) {
      throw new HttpError(
        409,
        "coverage_warnings_unresolved",
        "Resolve or accept all coverage warnings before approval.",
      );
    }

    const now = new Date();
    await db
      .update(projectsTable)
      .set({
        userFlowsApprovedAt: now,
        userFlowsApprovalSnapshot: {
          acceptedWarnings: payload.acceptedWarnings,
          approvedFlowIds: list.userFlows.map((flow) => flow.id),
        },
        updatedAt: now,
      })
      .where(eq(projectsTable.id, projectId));

    return this.list(ownerUserId, projectId);
  },
});

export type UserFlowService = ReturnType<typeof createUserFlowService>;
