import { and, desc, eq } from "drizzle-orm";

import { onePagerSchema } from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { onePagersTable, projectsTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const toOnePager = (record: typeof onePagersTable.$inferSelect) =>
  onePagerSchema.parse({
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

export const createOnePagerService = (db: AppDatabase) => ({
  async getCanonical(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    const onePager = await db.query.onePagersTable.findFirst({
      where: and(
        eq(onePagersTable.projectId, projectId),
        eq(onePagersTable.isCanonical, true),
      ),
      orderBy: [desc(onePagersTable.version)],
    });

    return onePager ? toOnePager(onePager) : null;
  },

  async listVersions(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }
    const versions = await db.query.onePagersTable.findMany({
      where: eq(onePagersTable.projectId, projectId),
      orderBy: [desc(onePagersTable.version)],
    });

    return versions.map(toOnePager);
  },

  async createVersion(input: {
    approve?: boolean;
    jobId?: string;
    markdown: string;
    projectId: string;
    source: string;
    title: string;
  }) {
    const latest = await db.query.onePagersTable.findFirst({
      where: eq(onePagersTable.projectId, input.projectId),
      orderBy: [desc(onePagersTable.version)],
    });
    const version = (latest?.version ?? 0) + 1;
    const now = new Date();

    await db
      .update(onePagersTable)
      .set({ isCanonical: false })
      .where(eq(onePagersTable.projectId, input.projectId));

    const [created] = await db
      .insert(onePagersTable)
      .values({
        id: generateId(),
        projectId: input.projectId,
        version,
        title: input.title,
        markdown: input.markdown,
        source: input.source,
        isCanonical: true,
        createdByJobId: input.jobId ?? null,
        approvedAt: input.approve ? now : null,
        createdAt: now,
      })
      .returning();

    if (input.approve) {
      await db
        .update(projectsTable)
        .set({
          onePagerApprovedAt: now,
          state: "READY",
          updatedAt: now,
        })
        .where(eq(projectsTable.id, input.projectId));
    } else {
      await db
        .update(projectsTable)
        .set({
          state: "READY_PARTIAL",
          updatedAt: now,
        })
        .where(eq(projectsTable.id, input.projectId));
    }

    return toOnePager(created);
  },

  async restoreVersion(ownerUserId: string, projectId: string, version: number) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    const versionRecord = await db.query.onePagersTable.findFirst({
      where: and(
        eq(onePagersTable.projectId, projectId),
        eq(onePagersTable.version, version),
      ),
    });

    if (!versionRecord) {
      throw new HttpError(404, "one_pager_not_found", "Overview document not found.");
    }

    await db
      .update(onePagersTable)
      .set({ isCanonical: false })
      .where(eq(onePagersTable.projectId, projectId));
    const [updated] = await db
      .update(onePagersTable)
      .set({ isCanonical: true })
      .where(eq(onePagersTable.id, versionRecord.id))
      .returning();

    return toOnePager(updated);
  },

  async approveCanonical(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    const canonical = await db.query.onePagersTable.findFirst({
      where: and(
        eq(onePagersTable.projectId, projectId),
        eq(onePagersTable.isCanonical, true),
      ),
      orderBy: [desc(onePagersTable.version)],
    });

    if (!canonical) {
      throw new HttpError(404, "one_pager_not_found", "Overview document not found.");
    }

    const now = new Date();
    const [updated] = await db
      .update(onePagersTable)
      .set({ approvedAt: now })
      .where(eq(onePagersTable.id, canonical.id))
      .returning();

    await db
      .update(projectsTable)
      .set({
        onePagerApprovedAt: now,
        state: "READY",
        updatedAt: now,
      })
      .where(eq(projectsTable.id, projectId));

    return toOnePager(updated);
  },
});

export type OnePagerService = ReturnType<typeof createOnePagerService>;
