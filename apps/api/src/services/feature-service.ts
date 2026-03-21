import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  type FeatureKind,
  type Priority,
  createFeatureDependencyRequestSchema,
  createFeatureRequestSchema,
  createFeatureRevisionRequestSchema,
  featureDependencyListResponseSchema,
  featureDependencySchema,
  featureGraphResponseSchema,
  featureGraphNodeSchema,
  featureListResponseSchema,
  featureRevisionListResponseSchema,
  featureRevisionSchema,
  featureRollupResponseSchema,
  featureSchema,
  updateFeatureRequestSchema,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  featureCasesTable,
  featureDependenciesTable,
  featureEdgesTable,
  featureRevisionsTable,
  milestonesTable,
  projectCountersTable,
  projectsTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const formatFeatureKey = (counter: number) => `F-${counter.toString().padStart(3, "0")}`;
const normalizeFeatureTitle = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const buildFeature = (
  feature: typeof featureCasesTable.$inferSelect,
  milestoneTitle: string,
  headRevision: typeof featureRevisionsTable.$inferSelect,
  dependencyIds: string[],
) =>
  featureSchema.parse({
    id: feature.id,
    projectId: feature.projectId,
    milestoneId: feature.milestoneId,
    milestoneTitle,
    featureKey: feature.featureKey,
    kind: feature.kind,
    priority: feature.priority,
    status: feature.status,
    headRevision: featureRevisionSchema.parse({
      id: headRevision.id,
      featureId: headRevision.featureId,
      version: headRevision.version,
      title: headRevision.title,
      summary: headRevision.summary,
      acceptanceCriteria: headRevision.acceptanceCriteria,
      source: headRevision.source,
      createdAt: headRevision.createdAt.toISOString(),
    }),
    dependencyIds,
    createdAt: feature.createdAt.toISOString(),
    updatedAt: feature.updatedAt.toISOString(),
    archivedAt: feature.archivedAt?.toISOString() ?? null,
  });

export const createFeatureService = (db: AppDatabase) => ({
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

  async getContext(ownerUserId: string, featureId: string) {
    const [feature] = await db
      .select({
        feature: featureCasesTable,
        ownerUserId: projectsTable.ownerUserId,
      })
      .from(featureCasesTable)
      .innerJoin(projectsTable, eq(projectsTable.id, featureCasesTable.projectId))
      .where(eq(featureCasesTable.id, featureId))
      .limit(1);

    if (!feature || feature.ownerUserId !== ownerUserId || feature.feature.archivedAt) {
      throw new HttpError(404, "feature_not_found", "Feature not found.");
    }

    return feature.feature;
  },

  async assertApprovedMilestone(projectId: string, milestoneId: string) {
    const milestone = await db.query.milestonesTable.findFirst({
      where: and(
        eq(milestonesTable.id, milestoneId),
        eq(milestonesTable.projectId, projectId),
      ),
    });

    if (!milestone) {
      throw new HttpError(404, "milestone_not_found", "Milestone not found.");
    }

    if (milestone.status !== "approved") {
      throw new HttpError(
        409,
        "approved_milestone_required",
        "Features must belong to an approved milestone.",
      );
    }

    return milestone;
  },

  async list(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const features = await db.query.featureCasesTable.findMany({
      where: and(
        eq(featureCasesTable.projectId, projectId),
        isNull(featureCasesTable.archivedAt),
      ),
      orderBy: [asc(featureCasesTable.featureKey)],
    });

    if (features.length === 0) {
      return featureListResponseSchema.parse({ features: [] });
    }

    const [milestones, revisions, dependencies] = await Promise.all([
      db.query.milestonesTable.findMany({
        where: inArray(
          milestonesTable.id,
          [...new Set(features.map((feature) => feature.milestoneId))],
        ),
      }),
      db.query.featureRevisionsTable.findMany({
        where: inArray(
          featureRevisionsTable.featureId,
          features.map((feature) => feature.id),
        ),
        orderBy: [desc(featureRevisionsTable.version)],
      }),
      db.query.featureDependenciesTable.findMany({
        where: inArray(
          featureDependenciesTable.featureId,
          features.map((feature) => feature.id),
        ),
      }),
    ]);

    const milestoneTitleById = new Map(milestones.map((milestone) => [milestone.id, milestone.title]));
    const headRevisionByFeatureId = new Map<string, typeof featureRevisionsTable.$inferSelect>();
    for (const revision of revisions) {
      if (!headRevisionByFeatureId.has(revision.featureId)) {
        headRevisionByFeatureId.set(revision.featureId, revision);
      }
    }
    const dependencyIdsByFeatureId = new Map<string, string[]>();
    for (const dependency of dependencies) {
      const existing = dependencyIdsByFeatureId.get(dependency.featureId) ?? [];
      existing.push(dependency.dependsOnFeatureId);
      dependencyIdsByFeatureId.set(dependency.featureId, existing);
    }

    return featureListResponseSchema.parse({
      features: features.map((feature) => {
        const headRevision = headRevisionByFeatureId.get(feature.id);
        if (!headRevision) {
          throw new Error(`Missing head revision for feature ${feature.id}.`);
        }

        return buildFeature(
          feature,
          milestoneTitleById.get(feature.milestoneId) ?? "Unknown milestone",
          headRevision,
          dependencyIdsByFeatureId.get(feature.id) ?? [],
        );
      }),
    });
  },

  async get(ownerUserId: string, featureId: string) {
    const feature = await this.getContext(ownerUserId, featureId);
    const list = await this.list(ownerUserId, feature.projectId);
    const result = list.features.find((item) => item.id === featureId);

    if (!result) {
      throw new HttpError(404, "feature_not_found", "Feature not found.");
    }

    return result;
  },

  async create(
    ownerUserId: string,
    projectId: string,
    input: unknown,
    createdByJobId?: string,
  ) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const payload = createFeatureRequestSchema.parse(input);
    await this.assertApprovedMilestone(projectId, payload.milestoneId);

    const featureId = await db.transaction(async (tx) => {
      const [counter] = await tx
        .update(projectCountersTable)
        .set({
          featureCounter: sql`${projectCountersTable.featureCounter} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(projectCountersTable.projectId, projectId))
        .returning();

      if (!counter) {
        throw new Error(`Missing project counter for project ${projectId}.`);
      }

      const now = new Date();
      const featureId = generateId();
      await tx.insert(featureCasesTable).values({
        id: featureId,
        projectId,
        milestoneId: payload.milestoneId,
        featureKey: formatFeatureKey(counter.featureCounter),
        kind: payload.kind,
        priority: payload.priority,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(featureRevisionsTable).values({
        id: generateId(),
        featureId,
        version: 1,
        title: payload.title,
        summary: payload.summary,
        acceptanceCriteria: payload.acceptanceCriteria,
        source: payload.source,
        createdByJobId: createdByJobId ?? null,
        createdAt: now,
      });

      return featureId;
    });

    return this.get(ownerUserId, featureId);
  },

  async update(ownerUserId: string, featureId: string, input: unknown) {
    const context = await this.getContext(ownerUserId, featureId);
    const payload = updateFeatureRequestSchema.parse(input);

    if (payload.milestoneId) {
      await this.assertApprovedMilestone(context.projectId, payload.milestoneId);
    }

    await db
      .update(featureCasesTable)
      .set({
        milestoneId: payload.milestoneId,
        kind: payload.kind,
        priority: payload.priority,
        status: payload.status,
        updatedAt: new Date(),
      })
      .where(eq(featureCasesTable.id, featureId));

    return this.get(ownerUserId, featureId);
  },

  async archive(ownerUserId: string, featureId: string) {
    const context = await this.getContext(ownerUserId, featureId);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(featureCasesTable)
        .set({
          status: "archived",
          archivedAt: now,
          updatedAt: now,
        })
        .where(eq(featureCasesTable.id, featureId));

      await tx
        .delete(featureDependenciesTable)
        .where(
          sql`${featureDependenciesTable.featureId} = ${featureId} or ${featureDependenciesTable.dependsOnFeatureId} = ${featureId}`,
        );
      await tx
        .delete(featureEdgesTable)
        .where(
          sql`${featureEdgesTable.featureId} = ${featureId} or ${featureEdgesTable.relatedFeatureId} = ${featureId}`,
        );
    });

    return this.list(ownerUserId, context.projectId);
  },

  async listRevisions(ownerUserId: string, featureId: string) {
    await this.getContext(ownerUserId, featureId);
    const revisions = await db.query.featureRevisionsTable.findMany({
      where: eq(featureRevisionsTable.featureId, featureId),
      orderBy: [desc(featureRevisionsTable.version)],
    });

    return featureRevisionListResponseSchema.parse({
      revisions: revisions.map((revision) =>
        featureRevisionSchema.parse({
          id: revision.id,
          featureId: revision.featureId,
          version: revision.version,
          title: revision.title,
          summary: revision.summary,
          acceptanceCriteria: revision.acceptanceCriteria,
          source: revision.source,
          createdAt: revision.createdAt.toISOString(),
        }),
      ),
    });
  },

  async createRevision(ownerUserId: string, featureId: string, input: unknown) {
    await this.getContext(ownerUserId, featureId);
    const payload = createFeatureRevisionRequestSchema.parse(input);

    await db.transaction(async (tx) => {
      const latest = await tx.query.featureRevisionsTable.findFirst({
        where: eq(featureRevisionsTable.featureId, featureId),
        orderBy: [desc(featureRevisionsTable.version)],
      });

      await tx.insert(featureRevisionsTable).values({
        id: generateId(),
        featureId,
        version: (latest?.version ?? 0) + 1,
        title: payload.title,
        summary: payload.summary,
        acceptanceCriteria: payload.acceptanceCriteria,
        source: payload.source,
        createdAt: new Date(),
      });

      await tx
        .update(featureCasesTable)
        .set({ updatedAt: new Date() })
        .where(eq(featureCasesTable.id, featureId));
    });

    return this.listRevisions(ownerUserId, featureId);
  },

  async listDependencies(ownerUserId: string, featureId: string) {
    await this.getContext(ownerUserId, featureId);
    const dependencies = await db.query.featureDependenciesTable.findMany({
      where: eq(featureDependenciesTable.featureId, featureId),
    });

    return featureDependencyListResponseSchema.parse({
      dependencies: dependencies.map((dependency) =>
        featureDependencySchema.parse({
          featureId: dependency.featureId,
          dependsOnFeatureId: dependency.dependsOnFeatureId,
        }),
      ),
    });
  },

  async buildDependencyAdjacency(projectId: string) {
    const [features, dependencies] = await Promise.all([
      db.query.featureCasesTable.findMany({
        where: and(
          eq(featureCasesTable.projectId, projectId),
          isNull(featureCasesTable.archivedAt),
        ),
      }),
      db.query.featureDependenciesTable.findMany(),
    ]);

    const featureIds = new Set(features.map((feature) => feature.id));
    const adjacency = new Map<string, string[]>();

    for (const featureId of featureIds) {
      adjacency.set(featureId, []);
    }

    for (const dependency of dependencies) {
      if (!featureIds.has(dependency.featureId) || !featureIds.has(dependency.dependsOnFeatureId)) {
        continue;
      }
      adjacency.get(dependency.featureId)!.push(dependency.dependsOnFeatureId);
    }

    return adjacency;
  },

  async addDependency(ownerUserId: string, featureId: string, input: unknown) {
    const feature = await this.getContext(ownerUserId, featureId);
    const payload = createFeatureDependencyRequestSchema.parse(input);
    const dependency = await this.getContext(ownerUserId, payload.dependsOnFeatureId);

    if (feature.projectId !== dependency.projectId) {
      throw new HttpError(
        400,
        "cross_project_dependency",
        "Feature dependencies must stay within the same project.",
      );
    }

    const adjacency = await this.buildDependencyAdjacency(feature.projectId);
    adjacency.get(featureId)?.push(payload.dependsOnFeatureId);

    const visit = (currentId: string, seen = new Set<string>()): boolean => {
      if (currentId === featureId && seen.size > 0) {
        return true;
      }
      if (seen.has(currentId)) {
        return false;
      }
      seen.add(currentId);
      return (adjacency.get(currentId) ?? []).some((nextId) => visit(nextId, new Set(seen)));
    };

    if ((adjacency.get(payload.dependsOnFeatureId) ?? []).some((nextId) => nextId === featureId) || visit(payload.dependsOnFeatureId)) {
      throw new HttpError(
        409,
        "dependency_cycle_detected",
        "Feature dependencies must remain acyclic.",
      );
    }

    await db.transaction(async (tx) => {
      await tx.insert(featureDependenciesTable).values({
        featureId,
        dependsOnFeatureId: payload.dependsOnFeatureId,
        createdAt: new Date(),
      });
      await tx.insert(featureEdgesTable).values({
        featureId,
        relatedFeatureId: payload.dependsOnFeatureId,
        edgeType: "depends_on",
        createdAt: new Date(),
      });
    });

    return this.listDependencies(ownerUserId, featureId);
  },

  async removeDependency(ownerUserId: string, featureId: string, dependsOnFeatureId: string) {
    await this.getContext(ownerUserId, featureId);
    await db.transaction(async (tx) => {
      await tx
        .delete(featureDependenciesTable)
        .where(
          and(
            eq(featureDependenciesTable.featureId, featureId),
            eq(featureDependenciesTable.dependsOnFeatureId, dependsOnFeatureId),
          ),
        );
      await tx
        .delete(featureEdgesTable)
        .where(
          and(
            eq(featureEdgesTable.featureId, featureId),
            eq(featureEdgesTable.relatedFeatureId, dependsOnFeatureId),
            eq(featureEdgesTable.edgeType, "depends_on"),
          ),
        );
    });

    return this.listDependencies(ownerUserId, featureId);
  },

  async getGraph(ownerUserId: string, projectId: string) {
    const featureList = await this.list(ownerUserId, projectId);
    const dependencies = await db.query.featureDependenciesTable.findMany({
      where: inArray(
        featureDependenciesTable.featureId,
        featureList.features.map((feature) => feature.id),
      ),
    });

    return featureGraphResponseSchema.parse({
      nodes: featureList.features.map((feature) =>
        featureGraphNodeSchema.parse({
          featureId: feature.id,
          featureKey: feature.featureKey,
          milestoneId: feature.milestoneId,
          milestoneTitle: feature.milestoneTitle,
          title: feature.headRevision.title,
          kind: feature.kind,
          priority: feature.priority,
          status: feature.status,
        }),
      ),
      edges: dependencies.map((dependency) => ({
        featureId: dependency.featureId,
        dependsOnFeatureId: dependency.dependsOnFeatureId,
        type: "depends_on" as const,
      })),
    });
  },

  async getRollup(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const [features, milestones] = await Promise.all([
      db.query.featureCasesTable.findMany({
        where: eq(featureCasesTable.projectId, projectId),
      }),
      db.query.milestonesTable.findMany({
        where: eq(milestonesTable.projectId, projectId),
      }),
    ]);

    const activeFeatures = features.filter((feature) => feature.archivedAt === null);
    const countBy = <T extends string>(values: T[]) =>
      [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>()).entries()].map(
        ([key, count]) => ({ key, count }),
      );
    const byMilestone = milestones.map((milestone) => ({
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      count: activeFeatures.filter((feature) => feature.milestoneId === milestone.id).length,
    }));

    return featureRollupResponseSchema.parse({
      totals: {
        active: activeFeatures.length,
        archived: features.length - activeFeatures.length,
      },
      byStatus: countBy(activeFeatures.map((feature) => feature.status)),
      byKind: countBy(activeFeatures.map((feature) => feature.kind)),
      byPriority: countBy(activeFeatures.map((feature) => feature.priority)),
      byMilestone,
    });
  },

  async appendGeneratedFeatures(input: {
    ownerUserId: string;
    projectId: string;
    milestoneId: string;
    createdByJobId?: string;
    items: Array<{
      title: string;
      summary: string;
      acceptanceCriteria: string[];
      kind: FeatureKind;
      priority: Priority;
    }>;
  }) {
    const existing = await this.list(input.ownerUserId, input.projectId);
    const existingTitles = new Set(
      existing.features.map((feature) => normalizeFeatureTitle(feature.headRevision.title)),
    );
    const createdIds: string[] = [];

    for (const item of input.items) {
      const normalizedTitle = normalizeFeatureTitle(item.title);
      if (existingTitles.has(normalizedTitle)) {
        continue;
      }

      existingTitles.add(normalizedTitle);
      const created = await this.create(
        input.ownerUserId,
        input.projectId,
        {
          milestoneId: input.milestoneId,
          kind: item.kind,
          priority: item.priority,
          title: item.title,
          summary: item.summary,
          acceptanceCriteria: item.acceptanceCriteria,
          source: "generated",
        },
        input.createdByJobId,
      );
      createdIds.push(created.id);
    }

    return {
      createdIds,
      skippedCount: input.items.length - createdIds.length,
    };
  },
});

export type FeatureService = ReturnType<typeof createFeatureService>;
