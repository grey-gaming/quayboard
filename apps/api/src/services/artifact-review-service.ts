import { and, desc, eq } from "drizzle-orm";

import {
  artifactApprovalSchema,
  artifactReviewItemSchema,
  artifactReviewItemsResponseSchema,
  artifactReviewRunSchema,
  artifactStateResponseSchema,
  type ArtifactType,
  type BlueprintKind,
  type ReviewItemSeverity,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  artifactApprovalsTable,
  artifactReviewItemsTable,
  artifactReviewRunsTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { BlueprintService } from "./blueprint-service.js";

const artifactTypeToBlueprintKind = (artifactType: ArtifactType): BlueprintKind =>
  artifactType === "blueprint_ux" ? "ux" : "tech";

const toReviewRun = (record: typeof artifactReviewRunsTable.$inferSelect) =>
  artifactReviewRunSchema.parse({
    id: record.id,
    projectId: record.projectId,
    artifactType: record.artifactType,
    artifactId: record.artifactId,
    jobId: record.jobId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  });

const toReviewItem = (record: typeof artifactReviewItemsTable.$inferSelect) =>
  artifactReviewItemSchema.parse({
    id: record.id,
    projectId: record.projectId,
    reviewRunId: record.reviewRunId,
    artifactType: record.artifactType,
    artifactId: record.artifactId,
    severity: record.severity,
    category: record.category,
    title: record.title,
    details: record.details,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

const toApproval = (record: typeof artifactApprovalsTable.$inferSelect) =>
  artifactApprovalSchema.parse({
    id: record.id,
    projectId: record.projectId,
    artifactType: record.artifactType,
    artifactId: record.artifactId,
    approvedByUserId: record.approvedByUserId,
    createdAt: record.createdAt.toISOString(),
  });

const countOpenItems = (
  items: ReturnType<typeof toReviewItem>[],
  severity: ReviewItemSeverity,
) => items.filter((item) => item.severity === severity && item.status === "OPEN").length;

export const createArtifactReviewService = (
  db: AppDatabase,
  blueprintService: BlueprintService,
) => ({
  async createRun(ownerUserId: string, projectId: string, artifactType: ArtifactType, artifactId: string, jobId: string) {
    const kind = artifactTypeToBlueprintKind(artifactType);
    await blueprintService.assertCanonicalBlueprint(ownerUserId, projectId, kind, artifactId);

    const [created] = await db
      .insert(artifactReviewRunsTable)
      .values({
        id: generateId(),
        projectId,
        artifactType,
        artifactId,
        jobId,
        status: "queued",
        createdAt: new Date(),
      })
      .returning();

    return toReviewRun(created);
  },

  async getLatestRun(projectId: string, artifactType: ArtifactType, artifactId: string) {
    return db.query.artifactReviewRunsTable.findFirst({
      where: and(
        eq(artifactReviewRunsTable.projectId, projectId),
        eq(artifactReviewRunsTable.artifactType, artifactType),
        eq(artifactReviewRunsTable.artifactId, artifactId),
      ),
      orderBy: [desc(artifactReviewRunsTable.createdAt)],
    });
  },

  async markRunRunning(jobId: string) {
    const [updated] = await db
      .update(artifactReviewRunsTable)
      .set({
        status: "running",
      })
      .where(eq(artifactReviewRunsTable.jobId, jobId))
      .returning();

    return updated ? toReviewRun(updated) : null;
  },

  async replaceRunItems(runId: string, items: Array<{
    artifactId: string;
    artifactType: ArtifactType;
    category: string;
    details: string;
    projectId: string;
    severity: ReviewItemSeverity;
    title: string;
  }>) {
    await db.transaction(async (tx) => {
      await tx.delete(artifactReviewItemsTable).where(eq(artifactReviewItemsTable.reviewRunId, runId));

      if (items.length === 0) {
        return;
      }

      const now = new Date();
      await tx.insert(artifactReviewItemsTable).values(
        items.map((item) => ({
          id: generateId(),
          projectId: item.projectId,
          reviewRunId: runId,
          artifactType: item.artifactType,
          artifactId: item.artifactId,
          severity: item.severity,
          category: item.category,
          title: item.title,
          details: item.details,
          status: "OPEN" as const,
          createdAt: now,
          updatedAt: now,
        })),
      );
    });
  },

  async markRunSucceeded(runId: string) {
    const [updated] = await db
      .update(artifactReviewRunsTable)
      .set({
        status: "succeeded",
        completedAt: new Date(),
      })
      .where(eq(artifactReviewRunsTable.id, runId))
      .returning();

    return updated ? toReviewRun(updated) : null;
  },

  async markRunFailed(jobId: string) {
    const [updated] = await db
      .update(artifactReviewRunsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
      })
      .where(eq(artifactReviewRunsTable.jobId, jobId))
      .returning();

    return updated ? toReviewRun(updated) : null;
  },

  async listItems(ownerUserId: string, projectId: string, artifactType: ArtifactType, artifactId: string) {
    await blueprintService.assertOwnedProject(ownerUserId, projectId);
    const latestRun = await this.getLatestRun(projectId, artifactType, artifactId);

    if (!latestRun) {
      return artifactReviewItemsResponseSchema.parse({ items: [] });
    }

    const items = await db.query.artifactReviewItemsTable.findMany({
      where: eq(artifactReviewItemsTable.reviewRunId, latestRun.id),
      orderBy: [artifactReviewItemsTable.createdAt],
    });

    return artifactReviewItemsResponseSchema.parse({
      items: items.map(toReviewItem),
    });
  },

  async getApproval(projectId: string, artifactType: ArtifactType, artifactId: string) {
    const approval = await db.query.artifactApprovalsTable.findFirst({
      where: and(
        eq(artifactApprovalsTable.projectId, projectId),
        eq(artifactApprovalsTable.artifactType, artifactType),
        eq(artifactApprovalsTable.artifactId, artifactId),
      ),
      orderBy: [desc(artifactApprovalsTable.createdAt)],
    });

    return approval ? toApproval(approval) : null;
  },

  async getState(ownerUserId: string, projectId: string, artifactType: ArtifactType, artifactId: string) {
    await blueprintService.assertOwnedProject(ownerUserId, projectId);
    const latestRun = await this.getLatestRun(projectId, artifactType, artifactId);
    const items = latestRun
      ? await db.query.artifactReviewItemsTable.findMany({
          where: eq(artifactReviewItemsTable.reviewRunId, latestRun.id),
          orderBy: [artifactReviewItemsTable.createdAt],
        })
      : [];
    const parsedItems = items.map(toReviewItem);
    const approval = await this.getApproval(projectId, artifactType, artifactId);

    return artifactStateResponseSchema.parse({
      artifactType,
      artifactId,
      latestReviewRun: latestRun ? toReviewRun(latestRun) : null,
      reviewItems: parsedItems,
      openBlockerCount: countOpenItems(parsedItems, "BLOCKER"),
      openWarningCount: countOpenItems(parsedItems, "WARNING"),
      openSuggestionCount: countOpenItems(parsedItems, "SUGGESTION"),
      approval,
    });
  },

  async updateReviewItem(ownerUserId: string, itemId: string, status: "DONE" | "ACCEPTED" | "IGNORED") {
    const existing = await db.query.artifactReviewItemsTable.findFirst({
      where: eq(artifactReviewItemsTable.id, itemId),
    });

    if (!existing) {
      throw new HttpError(404, "review_item_not_found", "Review item not found.");
    }

    await blueprintService.assertOwnedProject(ownerUserId, existing.projectId);

    const [updated] = await db
      .update(artifactReviewItemsTable)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(artifactReviewItemsTable.id, itemId))
      .returning();

    return toReviewItem(updated);
  },

  async approve(ownerUserId: string, projectId: string, artifactType: ArtifactType, artifactId: string) {
    const kind = artifactTypeToBlueprintKind(artifactType);
    await blueprintService.assertCanonicalBlueprint(ownerUserId, projectId, kind, artifactId);
    const latestRun = await this.getLatestRun(projectId, artifactType, artifactId);

    if (!latestRun || latestRun.status !== "succeeded") {
      throw new HttpError(
        409,
        "artifact_review_required",
        "Run and complete artifact review before approval.",
      );
    }

    const state = await this.getState(ownerUserId, projectId, artifactType, artifactId);

    if (state.openBlockerCount > 0) {
      throw new HttpError(
        409,
        "artifact_blockers_open",
        "Resolve or accept all blocker review items before approval.",
      );
    }

    const existingApproval = await this.getApproval(projectId, artifactType, artifactId);
    if (existingApproval) {
      return existingApproval;
    }

    const [created] = await db
      .insert(artifactApprovalsTable)
      .values({
        id: generateId(),
        projectId,
        artifactType,
        artifactId,
        approvedByUserId: ownerUserId,
        createdAt: new Date(),
      })
      .returning();

    return toApproval(created);
  },
});

export type ArtifactReviewService = ReturnType<typeof createArtifactReviewService>;
