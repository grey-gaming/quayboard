import { and, desc, eq } from "drizzle-orm";

import { productSpecSchema } from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { productSpecsTable, projectsTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const toProductSpec = (record: typeof productSpecsTable.$inferSelect) =>
  productSpecSchema.parse({
    id: record.id,
    projectId: record.projectId,
    version: record.version,
    title: record.title,
    markdown: record.markdown,
    source: record.source,
    isCanonical: record.isCanonical,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  });

export const createProductSpecService = (db: AppDatabase) => ({
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

  async getCanonicalRecord(projectId: string) {
    return db.query.productSpecsTable.findFirst({
      where: and(
        eq(productSpecsTable.projectId, projectId),
        eq(productSpecsTable.isCanonical, true),
      ),
      orderBy: [desc(productSpecsTable.version)],
    });
  },

  async getCanonical(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const productSpec = await this.getCanonicalRecord(projectId);

    return productSpec ? toProductSpec(productSpec) : null;
  },

  async listVersions(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const versions = await db.query.productSpecsTable.findMany({
      where: eq(productSpecsTable.projectId, projectId),
      orderBy: [desc(productSpecsTable.version)],
    });

    return versions.map(toProductSpec);
  },

  async createVersion(input: {
    jobId?: string;
    markdown: string;
    projectId: string;
    source: string;
    title: string;
  }) {
    const latest = await db.query.productSpecsTable.findFirst({
      where: eq(productSpecsTable.projectId, input.projectId),
      orderBy: [desc(productSpecsTable.version)],
    });
    const version = (latest?.version ?? 0) + 1;
    const now = new Date();

    await db
      .update(productSpecsTable)
      .set({ isCanonical: false })
      .where(eq(productSpecsTable.projectId, input.projectId));

    const [created] = await db
      .insert(productSpecsTable)
      .values({
        id: generateId(),
        projectId: input.projectId,
        version,
        title: input.title,
        markdown: input.markdown,
        source: input.source,
        isCanonical: true,
        createdByJobId: input.jobId ?? null,
        approvedAt: null,
        createdAt: now,
      })
      .returning();

    return toProductSpec(created);
  },

  async restoreVersion(ownerUserId: string, projectId: string, version: number) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const versionRecord = await db.query.productSpecsTable.findFirst({
      where: and(
        eq(productSpecsTable.projectId, projectId),
        eq(productSpecsTable.version, version),
      ),
    });

    if (!versionRecord) {
      throw new HttpError(404, "product_spec_not_found", "Product Spec not found.");
    }

    await db
      .update(productSpecsTable)
      .set({ isCanonical: false })
      .where(eq(productSpecsTable.projectId, projectId));
    const [updated] = await db
      .update(productSpecsTable)
      .set({ isCanonical: true })
      .where(eq(productSpecsTable.id, versionRecord.id))
      .returning();

    return toProductSpec(updated);
  },

  async approveCanonical(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const canonical = await this.getCanonicalRecord(projectId);

    if (!canonical) {
      throw new HttpError(404, "product_spec_not_found", "Product Spec not found.");
    }

    const now = new Date();
    const [updated] = await db
      .update(productSpecsTable)
      .set({ approvedAt: now })
      .where(eq(productSpecsTable.id, canonical.id))
      .returning();

    return toProductSpec(updated);
  },
});

export type ProductSpecService = ReturnType<typeof createProductSpecService>;
