import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  type ArtifactApproval,
  createMilestoneRequestSchema,
  milestoneActionRequestSchema,
  milestoneDesignDocListResponseSchema,
  milestoneDesignDocSchema,
  milestoneListResponseSchema,
  milestoneSchema,
  updateMilestoneRequestSchema,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  featureCasesTable,
  milestoneDesignDocsTable,
  milestoneUseCasesTable,
  milestonesTable,
  projectsTable,
  useCasesTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

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

export const createMilestoneService = (db: AppDatabase) => ({
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

  async list(ownerUserId: string, projectId: string) {
    await this.assertApprovedUserFlows(ownerUserId, projectId);

    const milestones = await db.query.milestonesTable.findMany({
      where: eq(milestonesTable.projectId, projectId),
      orderBy: [asc(milestonesTable.position)],
    });

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

    return milestoneListResponseSchema.parse({
      milestones: milestones.map((milestone) =>
        milestoneSchema.parse({
          id: milestone.id,
          projectId: milestone.projectId,
          position: milestone.position,
          title: milestone.title,
          summary: milestone.summary,
          status: milestone.status,
          linkedUserFlows: linksByMilestone.get(milestone.id) ?? [],
          featureCount: featureCountByMilestone.get(milestone.id) ?? 0,
          approvedAt: milestone.approvedAt?.toISOString() ?? null,
          completedAt: milestone.completedAt?.toISOString() ?? null,
          createdAt: milestone.createdAt.toISOString(),
          updatedAt: milestone.updatedAt.toISOString(),
        }),
      ),
      coverage: {
        approvedUserFlowCount: activeFlows.length,
        coveredUserFlowCount: coveredUserFlowIds.size,
        uncoveredUserFlowIds: activeFlows
          .map((flow) => flow.id)
          .filter((flowId) => !coveredUserFlowIds.has(flowId)),
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

    return db.transaction(async (tx) => {
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
    }).then((milestoneId) => this.list(ownerUserId, projectId).then((response) => {
      const milestone = response.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        throw new Error("Failed to load created milestone.");
      }
      return milestone;
    }));
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
        await tx
          .update(milestonesTable)
          .set({
            title: payload.title,
            summary: payload.summary,
            updatedAt: new Date(),
          })
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

    return this.list(ownerUserId, context.projectId).then((response) => {
      const milestone = response.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        throw new Error("Failed to load updated milestone.");
      }
      return milestone;
    });
  },

  async transition(ownerUserId: string, milestoneId: string, input: unknown) {
    const context = await this.getContext(ownerUserId, milestoneId);
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

      await db
        .update(milestonesTable)
        .set({
          status: "approved",
          approvedAt: now,
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

      await db
        .update(milestonesTable)
        .set({
          status: "completed",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(milestonesTable.id, milestoneId));
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
