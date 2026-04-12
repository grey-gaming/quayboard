import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { ContextPack, ContextPackType, MemoryChunk } from "@quayboard/shared";
import { contextPackSchema, memoryChunkSchema } from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  artifactApprovalsTable,
  contextPacksTable,
  featureArchDocRevisionsTable,
  featureArchDocSpecsTable,
  featureCasesTable,
  featureDeliveryTasksTable,
  featureProductRevisionsTable,
  featureProductSpecsTable,
  featureRevisionsTable,
  featureTechRevisionsTable,
  featureTechSpecsTable,
  featureTaskPlanningSessionsTable,
  featureUserDocRevisionsTable,
  featureUserDocSpecsTable,
  featureUxRevisionsTable,
  featureUxSpecsTable,
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

const codingContextLoadedCharBudget = 240_000;
const sandboxPromptOverheadChars = 3_500;

const estimateTaskFileChars = (
  tasks: Array<Pick<typeof featureDeliveryTasksTable.$inferSelect, "acceptanceCriteria" | "description" | "title">>,
) =>
  tasks.reduce(
    (total, task) =>
      total +
      task.title.length +
      task.description.length +
      JSON.stringify(task.acceptanceCriteria ?? []).length +
      16,
    0,
  );

const approvedFeatureDocOrder = [
  {
    coverageKey: "feature-product-spec",
    label: "Approved Feature Product Spec",
    omissionKey: "feature-product-spec-over-budget",
  },
  {
    coverageKey: "feature-tech-spec",
    label: "Approved Feature Tech Spec",
    omissionKey: "feature-tech-spec-over-budget",
  },
  {
    coverageKey: "feature-ux-spec",
    label: "Approved Feature UX Spec",
    omissionKey: "feature-ux-spec-over-budget",
  },
  {
    coverageKey: "feature-architecture-docs",
    label: "Approved Feature Architecture Documentation",
    omissionKey: "feature-architecture-docs-over-budget",
  },
  {
    coverageKey: "feature-user-docs",
    label: "Approved Feature User Documentation",
    omissionKey: "feature-user-docs-over-budget",
  },
] as const;

type ApprovedFeatureDoc = (typeof approvedFeatureDocOrder)[number] & {
  markdown: string;
};

export const buildBudgetedFeatureDocSections = (input: {
  approvedFeatureDocs: ApprovedFeatureDoc[];
  baseLoadedChars: number;
  budgetChars?: number;
}) => {
  const sourceCoverage: string[] = [];
  const omissionList: string[] = [];
  const sections: string[] = [];
  let projectedLoadedChars = input.baseLoadedChars;
  const budgetChars = input.budgetChars ?? codingContextLoadedCharBudget;

  for (const doc of input.approvedFeatureDocs) {
    const section = `## ${doc.label}\n${doc.markdown}`;
    if (projectedLoadedChars + section.length > budgetChars) {
      omissionList.push(doc.omissionKey);
      continue;
    }

    sourceCoverage.push(doc.coverageKey);
    projectedLoadedChars += section.length;
    sections.push(section);
  }

  return {
    omissionList,
    projectedLoadedChars,
    sections,
    sourceCoverage,
  };
};

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

  async listApprovedFeatureDocs(projectId: string, featureId: string): Promise<ApprovedFeatureDoc[]> {
    const [product, ux, tech, userDocs, archDocs] = await Promise.all([
      db
        .select({ markdown: featureProductRevisionsTable.markdown })
        .from(featureProductSpecsTable)
        .innerJoin(
          featureProductRevisionsTable,
          eq(featureProductRevisionsTable.id, featureProductSpecsTable.headRevisionId),
        )
        .innerJoin(
          artifactApprovalsTable,
          and(
            eq(artifactApprovalsTable.projectId, projectId),
            eq(artifactApprovalsTable.artifactType, "feature_product_revision"),
            eq(artifactApprovalsTable.artifactId, featureProductRevisionsTable.id),
          ),
        )
        .where(eq(featureProductSpecsTable.featureId, featureId))
        .limit(1),
      db
        .select({ markdown: featureUxRevisionsTable.markdown })
        .from(featureUxSpecsTable)
        .innerJoin(
          featureUxRevisionsTable,
          eq(featureUxRevisionsTable.id, featureUxSpecsTable.headRevisionId),
        )
        .innerJoin(
          artifactApprovalsTable,
          and(
            eq(artifactApprovalsTable.projectId, projectId),
            eq(artifactApprovalsTable.artifactType, "feature_ux_revision"),
            eq(artifactApprovalsTable.artifactId, featureUxRevisionsTable.id),
          ),
        )
        .where(eq(featureUxSpecsTable.featureId, featureId))
        .limit(1),
      db
        .select({ markdown: featureTechRevisionsTable.markdown })
        .from(featureTechSpecsTable)
        .innerJoin(
          featureTechRevisionsTable,
          eq(featureTechRevisionsTable.id, featureTechSpecsTable.headRevisionId),
        )
        .innerJoin(
          artifactApprovalsTable,
          and(
            eq(artifactApprovalsTable.projectId, projectId),
            eq(artifactApprovalsTable.artifactType, "feature_tech_revision"),
            eq(artifactApprovalsTable.artifactId, featureTechRevisionsTable.id),
          ),
        )
        .where(eq(featureTechSpecsTable.featureId, featureId))
        .limit(1),
      db
        .select({ markdown: featureUserDocRevisionsTable.markdown })
        .from(featureUserDocSpecsTable)
        .innerJoin(
          featureUserDocRevisionsTable,
          eq(featureUserDocRevisionsTable.id, featureUserDocSpecsTable.headRevisionId),
        )
        .innerJoin(
          artifactApprovalsTable,
          and(
            eq(artifactApprovalsTable.projectId, projectId),
            eq(artifactApprovalsTable.artifactType, "feature_user_doc_revision"),
            eq(artifactApprovalsTable.artifactId, featureUserDocRevisionsTable.id),
          ),
        )
        .where(eq(featureUserDocSpecsTable.featureId, featureId))
        .limit(1),
      db
        .select({ markdown: featureArchDocRevisionsTable.markdown })
        .from(featureArchDocSpecsTable)
        .innerJoin(
          featureArchDocRevisionsTable,
          eq(featureArchDocRevisionsTable.id, featureArchDocSpecsTable.headRevisionId),
        )
        .innerJoin(
          artifactApprovalsTable,
          and(
            eq(artifactApprovalsTable.projectId, projectId),
            eq(artifactApprovalsTable.artifactType, "feature_arch_doc_revision"),
            eq(artifactApprovalsTable.artifactId, featureArchDocRevisionsTable.id),
          ),
        )
        .where(eq(featureArchDocSpecsTable.featureId, featureId))
        .limit(1),
    ]);

    const byCoverageKey = new Map<string, string | undefined>([
      ["feature-product-spec", product[0]?.markdown],
      ["feature-ux-spec", ux[0]?.markdown],
      ["feature-tech-spec", tech[0]?.markdown],
      ["feature-user-docs", userDocs[0]?.markdown],
      ["feature-architecture-docs", archDocs[0]?.markdown],
    ]);

    return approvedFeatureDocOrder.flatMap((metadata) => {
      const markdown = byCoverageKey.get(metadata.coverageKey);
      return markdown ? [{ ...metadata, markdown }] : [];
    });
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
    const projectContextSections = [
      "## Repository Memory",
      memoryChunks.map((chunk) => `### ${chunk.key}\n${chunk.content}`).join("\n\n"),
      onePager ? `## Overview\n${onePager.markdown}` : "",
      productSpec ? `## Product Spec\n${productSpec.markdown}` : "",
      uxSpec ? `## UX Spec\n${uxSpec.markdown}` : "",
      techSpec ? `## Technical Spec\n${techSpec.markdown}` : "",
    ].filter(Boolean);

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
      const headFeatureRevision = feature
        ? await db.query.featureRevisionsTable.findFirst({
            where: eq(featureRevisionsTable.featureId, input.featureId),
            orderBy: [desc(featureRevisionsTable.version)],
          })
        : null;
      const session = await db.query.featureTaskPlanningSessionsTable.findFirst({
        where: eq(featureTaskPlanningSessionsTable.featureId, input.featureId),
      });
      const tasks = session
        ? await db.query.featureDeliveryTasksTable.findMany({
            where: eq(featureDeliveryTasksTable.sessionId, session.id),
            orderBy: [asc(featureDeliveryTasksTable.position)],
          })
        : [];
      const approvedFeatureDocs =
        input.type === "coding" && feature
          ? await this.listApprovedFeatureDocs(projectId, feature.id)
          : [];

      const baseFeatureSection = [
        feature
          ? `Feature Key: ${feature.featureKey}\nMilestone ID: ${feature.milestoneId}`
          : "Feature: unavailable",
        headFeatureRevision
          ? [
              `Title: ${headFeatureRevision.title}`,
              `Summary: ${headFeatureRevision.summary}`,
              "Acceptance Criteria:",
              ...((headFeatureRevision.acceptanceCriteria as string[] | null | undefined) ?? []).map(
                (criterion) => `- ${criterion}`,
              ),
            ].join("\n")
          : "Feature revision: unavailable",
        tasks.length > 0
          ? `Tasks:\n${tasks.map((task, index) => `${index + 1}. ${task.title}\n${task.description}`).join("\n\n")}`
          : "Tasks: unavailable",
      ].join("\n\n");
      const baseLoadedChars =
        sandboxPromptOverheadChars +
        estimateTaskFileChars(tasks) +
        projectContextSections.join("\n\n").length +
        baseFeatureSection.length;
      const budgetedDocs = buildBudgetedFeatureDocSections({
        approvedFeatureDocs,
        baseLoadedChars,
      });
      const featureSections = [baseFeatureSection, ...budgetedDocs.sections];
      omissionList.push(...budgetedDocs.omissionList);
      sourceCoverage.push(...budgetedDocs.sourceCoverage);

      featureSection = featureSections.join("\n\n");

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
      ...projectContextSections,
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
