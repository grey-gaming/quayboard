import { and, desc, eq } from "drizzle-orm";

import {
  artifactApprovalSchema,
  artifactApprovalStateResponseSchema,
  type ArtifactType,
  type BlueprintKind,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { artifactApprovalsTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { type BlueprintService } from "./blueprint-service.js";

const artifactTypeToBlueprintKind = (artifactType: ArtifactType): BlueprintKind =>
  artifactType === "blueprint_ux" ? "ux" : "tech";

const toApproval = (record: typeof artifactApprovalsTable.$inferSelect) =>
  artifactApprovalSchema.parse({
    id: record.id,
    projectId: record.projectId,
    artifactType: record.artifactType,
    artifactId: record.artifactId,
    approvedByUserId: record.approvedByUserId,
    createdAt: record.createdAt.toISOString(),
  });

export const createArtifactApprovalService = (
  db: AppDatabase,
  blueprintService: BlueprintService,
) => ({
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
    const approval = await this.getApproval(projectId, artifactType, artifactId);

    return artifactApprovalStateResponseSchema.parse({
      artifactType,
      artifactId,
      approval,
    });
  },

  async approve(ownerUserId: string, projectId: string, artifactType: ArtifactType, artifactId: string) {
    const kind = artifactTypeToBlueprintKind(artifactType);
    await blueprintService.assertCanonicalBlueprint(ownerUserId, projectId, kind, artifactId);

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

export type ArtifactApprovalService = ReturnType<typeof createArtifactApprovalService>;
