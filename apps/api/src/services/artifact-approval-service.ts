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
import { HttpError } from "./http-error.js";
import { type BlueprintService } from "./blueprint-service.js";
import { type ProductSpecService } from "./product-spec-service.js";

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
  productSpecService: ProductSpecService,
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

    if (artifactType === "blueprint_ux") {
      const productSpec = await productSpecService.getCanonical(ownerUserId, projectId);

      if (!productSpec?.approvedAt) {
        throw new HttpError(
          409,
          "product_spec_approval_required",
          "Approve the Product Spec before approving the UX Spec.",
        );
      }
    } else {
      const uxSpec = await blueprintService.getCanonicalByKind(ownerUserId, projectId, "ux");

      if (!uxSpec) {
        throw new HttpError(
          409,
          "ux_spec_required",
          "Generate the UX Spec before approving the Technical Spec.",
        );
      }

      const uxApproval = await this.getApproval(projectId, "blueprint_ux", uxSpec.id);
      if (!uxApproval) {
        throw new HttpError(
          409,
          "ux_spec_approval_required",
          "Approve the UX Spec before approving the Technical Spec.",
        );
      }
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

export type ArtifactApprovalService = ReturnType<typeof createArtifactApprovalService>;
