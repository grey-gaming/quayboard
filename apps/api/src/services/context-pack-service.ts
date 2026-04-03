import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { ContextPack, ContextPackType, MemoryChunk } from "@quayboard/shared";
import { contextPackSchema, memoryChunkSchema } from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  contextPacksTable,
  featureCasesTable,
  featureDeliveryTasksTable,
  featureTaskPlanningSessionsTable,
  jobsTable,
  logbookVersionsTable,
  memoryChunksTable,
  onePagersTable,
  productSpecsTable,
  projectBlueprintsTable,
  projectsTable,
  reposTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const toMemoryChunk = (record: typeof memoryChunksTable.$inferSelect): MemoryChunk =>
  memoryChunkSchema.parse({
    id: record.id,
    projectId: record.projectId,
    key: record.key,
    content: record.content,
    sourceType: record.sourceType,
    sourceId: record.sourceId ?? null,
    createdByJobId: record.createdByJobId ?? null,
    createdAt: record.createdAt.toISOString(),
  });

const toContextPack = (record: typeof contextPacksTable.$inferSelect): ContextPack =>
  contextPackSchema.parse({
    id: record.id,
    projectId: record.projectId,
    featureId: record.featureId ?? null,
    type: record.type,
    version: record.version,
    content: record.content,
    summary: record.summary,
    stale: record.stale,
    omissionList: (record.omissionList as string[]) ?? [],
    sourceCoverage: (record.sourceCoverage as string[]) ?? [],
    createdByJobId: record.createdByJobId ?? null,
    createdAt: record.createdAt.toISOString(),
  });

export const createContextPackService = (db: AppDatabase) => ({
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

  async listMemoryChunks(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const records = await db.query.memoryChunksTable.findMany({
      where: eq(memoryChunksTable.projectId, projectId),
      orderBy: [asc(memoryChunksTable.key)],
    });

    return records.map(toMemoryChunk);
  },

  async listContextPacks(ownerUserId: string, projectId: string, featureId?: string | null) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const records = await db.query.contextPacksTable.findMany({
      where:
        featureId === undefined
          ? eq(contextPacksTable.projectId, projectId)
          : and(
              eq(contextPacksTable.projectId, projectId),
              featureId === null
                ? isNull(contextPacksTable.featureId)
                : eq(contextPacksTable.featureId, featureId),
            ),
      orderBy: [desc(contextPacksTable.createdAt)],
    });

    return records.map(toContextPack);
  },

  async buildRepoFingerprint(ownerUserId: string, projectId: string, createdByJobId: string | null = null) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const repo = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, projectId),
    });

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });

    const content = [
      `Project: ${project?.name ?? "Unknown project"}`,
      `Description: ${project?.description ?? "None"}`,
      `Repository Provider: ${repo?.provider ?? "unconfigured"}`,
      `Repository: ${repo?.owner && repo.name ? `${repo.owner}/${repo.name}` : "unconfigured"}`,
      `Default Branch: ${repo?.defaultBranch ?? "unknown"}`,
      `Repository URL: ${repo?.repoUrl ?? "unknown"}`,
      `Last Seen SHA: ${repo?.lastSeenSha ?? "unknown"}`,
    ].join("\n");

    const now = new Date();
    const logbookId = generateId();
    await db.insert(logbookVersionsTable).values({
      id: logbookId,
      projectId,
      coverageFlags: { repoFingerprint: true },
      createdByJobId,
      createdAt: now,
    });

    const existing = await db.query.memoryChunksTable.findFirst({
      where: and(
        eq(memoryChunksTable.projectId, projectId),
        eq(memoryChunksTable.key, "repo-fingerprint"),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(memoryChunksTable)
        .set({
          logbookVersionId: logbookId,
          content,
          sourceType: "repo",
          sourceId: repo?.id ?? null,
          createdByJobId,
          createdAt: now,
        })
        .where(eq(memoryChunksTable.id, existing.id))
        .returning();

      return toMemoryChunk(updated);
    }

    const [created] = await db
      .insert(memoryChunksTable)
      .values({
        id: generateId(),
        projectId,
        logbookVersionId: logbookId,
        key: "repo-fingerprint",
        content,
        sourceType: "repo",
        sourceId: repo?.id ?? null,
        createdByJobId,
        createdAt: now,
      })
      .returning();

    return toMemoryChunk(created);
  },

  async buildContextPack(
    ownerUserId: string,
    projectId: string,
    input: {
      featureId?: string | null;
      type: ContextPackType;
      createdByJobId?: string | null;
    },
  ) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const [memoryChunks, onePager, productSpec, uxSpec, techSpec] = await Promise.all([
      this.listMemoryChunks(ownerUserId, projectId),
      db.query.onePagersTable.findFirst({
        where: and(eq(onePagersTable.projectId, projectId), eq(onePagersTable.isCanonical, true)),
        orderBy: [desc(onePagersTable.version)],
      }),
      db.query.productSpecsTable.findFirst({
        where: and(eq(productSpecsTable.projectId, projectId), eq(productSpecsTable.isCanonical, true)),
        orderBy: [desc(productSpecsTable.version)],
      }),
      db.query.projectBlueprintsTable.findFirst({
        where: and(
          eq(projectBlueprintsTable.projectId, projectId),
          eq(projectBlueprintsTable.kind, "ux"),
          eq(projectBlueprintsTable.isCanonical, true),
        ),
        orderBy: [desc(projectBlueprintsTable.version)],
      }),
      db.query.projectBlueprintsTable.findFirst({
        where: and(
          eq(projectBlueprintsTable.projectId, projectId),
          eq(projectBlueprintsTable.kind, "tech"),
          eq(projectBlueprintsTable.isCanonical, true),
        ),
        orderBy: [desc(projectBlueprintsTable.version)],
      }),
    ]);

    let featureSection = "";
    const sourceCoverage = ["repo-fingerprint"];
    const omissionList: string[] = [];

    if (onePager) {
      sourceCoverage.push("overview");
    } else {
      omissionList.push("overview");
    }

    if (productSpec) {
      sourceCoverage.push("product-spec");
    } else {
      omissionList.push("product-spec");
    }

    if (uxSpec) {
      sourceCoverage.push("ux-spec");
    } else {
      omissionList.push("ux-spec");
    }

    if (techSpec) {
      sourceCoverage.push("technical-spec");
    } else {
      omissionList.push("technical-spec");
    }

    if (input.featureId) {
      const feature = await db.query.featureCasesTable.findFirst({
        where: eq(featureCasesTable.id, input.featureId),
      });
      const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
        where: eq(featureTaskPlanningSessionsTable.featureId, input.featureId),
      });
      const tasks = session
        ? await db.query.featureDeliveryTasksTable.findMany({
            where: eq(featureDeliveryTasksTable.sessionId, session.id),
            orderBy: [asc(featureDeliveryTasksTable.position)],
          })
        : [];

      featureSection = [
        feature
          ? `Feature Key: ${feature.featureKey}\nMilestone ID: ${feature.milestoneId}`
          : "Feature: unavailable",
        tasks.length > 0
          ? `Tasks:\n${tasks.map((task, index) => `${index + 1}. ${task.title}\n${task.description}`).join("\n\n")}`
          : "Tasks: unavailable",
      ].join("\n\n");

      if (feature) {
        sourceCoverage.push("feature");
      } else {
        omissionList.push("feature");
      }

      if (tasks.length > 0) {
        sourceCoverage.push("delivery-tasks");
      } else {
        omissionList.push("delivery-tasks");
      }
    }

    const content = [
      `# ${input.type === "coding" ? "Coding" : "Planning"} Context Pack`,
      "",
      "## Repository Memory",
      memoryChunks.map((chunk) => `### ${chunk.key}\n${chunk.content}`).join("\n\n"),
      onePager ? `## Overview\n${onePager.markdown}` : "",
      productSpec ? `## Product Spec\n${productSpec.markdown}` : "",
      uxSpec ? `## UX Spec\n${uxSpec.markdown}` : "",
      techSpec ? `## Technical Spec\n${techSpec.markdown}` : "",
      featureSection ? `## Feature Context\n${featureSection}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const latestPack = await db.query.contextPacksTable.findFirst({
      where: and(
        eq(contextPacksTable.projectId, projectId),
        input.featureId === undefined
          ? isNull(contextPacksTable.featureId)
          : input.featureId === null
            ? isNull(contextPacksTable.featureId)
            : eq(contextPacksTable.featureId, input.featureId),
        eq(contextPacksTable.type, input.type),
      ),
      orderBy: [desc(contextPacksTable.version)],
    });

    const [created] = await db
      .insert(contextPacksTable)
      .values({
        id: generateId(),
        projectId,
        featureId: input.featureId ?? null,
        type: input.type,
        version: (latestPack?.version ?? 0) + 1,
        content,
        summary: input.featureId
          ? `${input.type} context pack for feature ${input.featureId}`
          : `${input.type} project context pack`,
        stale: false,
        omissionList,
        sourceCoverage,
        createdByJobId: input.createdByJobId ?? null,
        createdAt: new Date(),
      })
      .returning();

    return toContextPack(created);
  },
});

export type ContextPackService = ReturnType<typeof createContextPackService>;
