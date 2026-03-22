import { and, desc, eq } from "drizzle-orm";

import {
  artifactApprovalSchema,
  createFeatureProductRevisionRequestSchema,
  createFeatureWorkstreamRevisionRequestSchema,
  featureTrackSummarySchema,
  featureTracksResponseSchema,
  featureWorkstreamRequirementsSchema,
  featureWorkstreamRevisionListResponseSchema,
  featureWorkstreamRevisionSchema,
  type ArtifactType,
  type FeatureTrackSummary,
  type FeatureWorkstreamKind,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  artifactApprovalsTable,
  featureArchDocRevisionsTable,
  featureArchDocSpecsTable,
  featureCasesTable,
  featureProductRevisionsTable,
  featureProductSpecsTable,
  featureRevisionsTable,
  featureTechRevisionsTable,
  featureTechSpecsTable,
  featureUserDocRevisionsTable,
  featureUserDocSpecsTable,
  featureUxRevisionsTable,
  featureUxSpecsTable,
  projectsTable,
} from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const workstreamLabels: Record<FeatureWorkstreamKind, string> = {
  product: "Product Spec",
  ux: "UX Spec",
  tech: "Tech Spec",
  user_docs: "User Documentation",
  arch_docs: "Architecture Documentation",
};

const workstreamArtifactTypes: Record<FeatureWorkstreamKind, ArtifactType> = {
  product: "feature_product_revision",
  ux: "feature_ux_revision",
  tech: "feature_tech_revision",
  user_docs: "feature_user_doc_revision",
  arch_docs: "feature_arch_doc_revision",
};

const defaultRequirements = {
  uxRequired: true,
  techRequired: true,
  userDocsRequired: true,
  archDocsRequired: true,
} as const;

const toApproval = (record: typeof artifactApprovalsTable.$inferSelect) =>
  artifactApprovalSchema.parse({
    id: record.id,
    projectId: record.projectId,
    artifactType: record.artifactType,
    artifactId: record.artifactId,
    approvedByUserId: record.approvedByUserId,
    createdAt: record.createdAt.toISOString(),
  });

const toRevisionTitle = (
  baseTitle: string,
  kind: FeatureWorkstreamKind,
  explicitTitle?: string,
) => explicitTitle?.trim() || `${baseTitle} ${workstreamLabels[kind]}`;

export const createFeatureWorkstreamService = (db: AppDatabase) => ({
  async getFeatureContext(ownerUserId: string, featureId: string) {
    const [record] = await db
      .select({
        feature: featureCasesTable,
        ownerUserId: projectsTable.ownerUserId,
      })
      .from(featureCasesTable)
      .innerJoin(projectsTable, eq(projectsTable.id, featureCasesTable.projectId))
      .where(eq(featureCasesTable.id, featureId))
      .limit(1);

    if (!record || record.ownerUserId !== ownerUserId || record.feature.archivedAt) {
      throw new HttpError(404, "feature_not_found", "Feature not found.");
    }

    const headFeatureRevision = await db.query.featureRevisionsTable.findFirst({
      where: eq(featureRevisionsTable.featureId, featureId),
      orderBy: [desc(featureRevisionsTable.version)],
    });

    if (!headFeatureRevision) {
      throw new Error(`Missing head feature revision for feature ${featureId}.`);
    }

    return {
      feature: record.feature,
      headFeatureRevision,
    };
  },

  async getApproval(projectId: string, kind: FeatureWorkstreamKind, revisionId: string) {
    const record = await db.query.artifactApprovalsTable.findFirst({
      where: and(
        eq(artifactApprovalsTable.projectId, projectId),
        eq(artifactApprovalsTable.artifactType, workstreamArtifactTypes[kind]),
        eq(artifactApprovalsTable.artifactId, revisionId),
      ),
      orderBy: [desc(artifactApprovalsTable.createdAt)],
    });

    return record ? toApproval(record) : null;
  },

  async ensureSpecRecord(featureId: string, kind: FeatureWorkstreamKind) {
    const now = new Date();

    switch (kind) {
      case "product": {
        const existing = await db.query.featureProductSpecsTable.findFirst({
          where: eq(featureProductSpecsTable.featureId, featureId),
        });
        if (!existing) {
          await db.insert(featureProductSpecsTable).values({
            id: generateId(),
            featureId,
            headRevisionId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
        return;
      }
      case "ux": {
        const existing = await db.query.featureUxSpecsTable.findFirst({
          where: eq(featureUxSpecsTable.featureId, featureId),
        });
        if (!existing) {
          await db.insert(featureUxSpecsTable).values({
            id: generateId(),
            featureId,
            headRevisionId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
        return;
      }
      case "tech": {
        const existing = await db.query.featureTechSpecsTable.findFirst({
          where: eq(featureTechSpecsTable.featureId, featureId),
        });
        if (!existing) {
          await db.insert(featureTechSpecsTable).values({
            id: generateId(),
            featureId,
            headRevisionId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
        return;
      }
      case "user_docs": {
        const existing = await db.query.featureUserDocSpecsTable.findFirst({
          where: eq(featureUserDocSpecsTable.featureId, featureId),
        });
        if (!existing) {
          await db.insert(featureUserDocSpecsTable).values({
            id: generateId(),
            featureId,
            headRevisionId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
        return;
      }
      case "arch_docs": {
        const existing = await db.query.featureArchDocSpecsTable.findFirst({
          where: eq(featureArchDocSpecsTable.featureId, featureId),
        });
        if (!existing) {
          await db.insert(featureArchDocSpecsTable).values({
            id: generateId(),
            featureId,
            headRevisionId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  },

  async listRevisions(ownerUserId: string, featureId: string, kind: FeatureWorkstreamKind) {
    const context = await this.getFeatureContext(ownerUserId, featureId);
    let revisions:
      | typeof featureProductRevisionsTable.$inferSelect[]
      | typeof featureUxRevisionsTable.$inferSelect[]
      | typeof featureTechRevisionsTable.$inferSelect[]
      | typeof featureUserDocRevisionsTable.$inferSelect[]
      | typeof featureArchDocRevisionsTable.$inferSelect[];

    switch (kind) {
      case "product":
        revisions = await db.query.featureProductRevisionsTable.findMany({
          where: eq(featureProductRevisionsTable.featureId, featureId),
          orderBy: [desc(featureProductRevisionsTable.version)],
        });
        break;
      case "ux":
        revisions = await db.query.featureUxRevisionsTable.findMany({
          where: eq(featureUxRevisionsTable.featureId, featureId),
          orderBy: [desc(featureUxRevisionsTable.version)],
        });
        break;
      case "tech":
        revisions = await db.query.featureTechRevisionsTable.findMany({
          where: eq(featureTechRevisionsTable.featureId, featureId),
          orderBy: [desc(featureTechRevisionsTable.version)],
        });
        break;
      case "user_docs":
        revisions = await db.query.featureUserDocRevisionsTable.findMany({
          where: eq(featureUserDocRevisionsTable.featureId, featureId),
          orderBy: [desc(featureUserDocRevisionsTable.version)],
        });
        break;
      case "arch_docs":
        revisions = await db.query.featureArchDocRevisionsTable.findMany({
          where: eq(featureArchDocRevisionsTable.featureId, featureId),
          orderBy: [desc(featureArchDocRevisionsTable.version)],
        });
        break;
    }

    const mapped = await Promise.all(
      revisions.map(async (revision) =>
        featureWorkstreamRevisionSchema.parse({
          id: revision.id,
          featureId,
          kind,
          version: revision.version,
          title: revision.title,
          markdown: revision.markdown,
          source: revision.source,
          createdAt: revision.createdAt.toISOString(),
          approval: await this.getApproval(context.feature.projectId, kind, revision.id),
          requirements:
            kind === "product"
              ? featureWorkstreamRequirementsSchema.parse({
                  uxRequired: (revision as typeof featureProductRevisionsTable.$inferSelect)
                    .uxRequired,
                  techRequired: (revision as typeof featureProductRevisionsTable.$inferSelect)
                    .techRequired,
                  userDocsRequired: (
                    revision as typeof featureProductRevisionsTable.$inferSelect
                  ).userDocsRequired,
                  archDocsRequired: (
                    revision as typeof featureProductRevisionsTable.$inferSelect
                  ).archDocsRequired,
                })
              : null,
        }),
      ),
    );

    return featureWorkstreamRevisionListResponseSchema.parse({ revisions: mapped });
  },

  async createRevision(
    ownerUserId: string,
    featureId: string,
    kind: FeatureWorkstreamKind,
    input: unknown,
    createdByJobId?: string,
  ) {
    const { feature, headFeatureRevision } = await this.getFeatureContext(ownerUserId, featureId);
    await this.ensureSpecRecord(featureId, kind);
    const now = new Date();

    if (kind === "product") {
      const payload = createFeatureProductRevisionRequestSchema.parse(input);
      const latest = await db.query.featureProductRevisionsTable.findFirst({
        where: eq(featureProductRevisionsTable.featureId, featureId),
        orderBy: [desc(featureProductRevisionsTable.version)],
      });
      const version = (latest?.version ?? 0) + 1;
      const id = generateId();

      await db.insert(featureProductRevisionsTable).values({
        id,
        featureId,
        version,
        title: toRevisionTitle(headFeatureRevision.title, kind, payload.title),
        markdown: payload.markdown,
        uxRequired: payload.requirements.uxRequired,
        techRequired: payload.requirements.techRequired,
        userDocsRequired: payload.requirements.userDocsRequired,
        archDocsRequired: payload.requirements.archDocsRequired,
        source: payload.source,
        createdByJobId: createdByJobId ?? null,
        createdAt: now,
      });
      await db
        .update(featureProductSpecsTable)
        .set({
          headRevisionId: id,
          updatedAt: now,
        })
        .where(eq(featureProductSpecsTable.featureId, featureId));

      return this.listRevisions(ownerUserId, featureId, kind);
    }

    const payload = createFeatureWorkstreamRevisionRequestSchema.parse(input);
    let latestVersion = 0;
    const id = generateId();

    switch (kind) {
      case "ux": {
        const latest = await db.query.featureUxRevisionsTable.findFirst({
          where: eq(featureUxRevisionsTable.featureId, featureId),
          orderBy: [desc(featureUxRevisionsTable.version)],
        });
        latestVersion = latest?.version ?? 0;
        await db.insert(featureUxRevisionsTable).values({
          id,
          featureId,
          version: latestVersion + 1,
          title: toRevisionTitle(headFeatureRevision.title, kind, payload.title),
          markdown: payload.markdown,
          source: payload.source,
          createdByJobId: createdByJobId ?? null,
          createdAt: now,
        });
        await db
          .update(featureUxSpecsTable)
          .set({ headRevisionId: id, updatedAt: now })
          .where(eq(featureUxSpecsTable.featureId, featureId));
        break;
      }
      case "tech": {
        const latest = await db.query.featureTechRevisionsTable.findFirst({
          where: eq(featureTechRevisionsTable.featureId, featureId),
          orderBy: [desc(featureTechRevisionsTable.version)],
        });
        latestVersion = latest?.version ?? 0;
        await db.insert(featureTechRevisionsTable).values({
          id,
          featureId,
          version: latestVersion + 1,
          title: toRevisionTitle(headFeatureRevision.title, kind, payload.title),
          markdown: payload.markdown,
          source: payload.source,
          createdByJobId: createdByJobId ?? null,
          createdAt: now,
        });
        await db
          .update(featureTechSpecsTable)
          .set({ headRevisionId: id, updatedAt: now })
          .where(eq(featureTechSpecsTable.featureId, featureId));
        break;
      }
      case "user_docs": {
        const latest = await db.query.featureUserDocRevisionsTable.findFirst({
          where: eq(featureUserDocRevisionsTable.featureId, featureId),
          orderBy: [desc(featureUserDocRevisionsTable.version)],
        });
        latestVersion = latest?.version ?? 0;
        await db.insert(featureUserDocRevisionsTable).values({
          id,
          featureId,
          version: latestVersion + 1,
          title: toRevisionTitle(headFeatureRevision.title, kind, payload.title),
          markdown: payload.markdown,
          source: payload.source,
          createdByJobId: createdByJobId ?? null,
          createdAt: now,
        });
        await db
          .update(featureUserDocSpecsTable)
          .set({ headRevisionId: id, updatedAt: now })
          .where(eq(featureUserDocSpecsTable.featureId, featureId));
        break;
      }
      case "arch_docs": {
        const latest = await db.query.featureArchDocRevisionsTable.findFirst({
          where: eq(featureArchDocRevisionsTable.featureId, featureId),
          orderBy: [desc(featureArchDocRevisionsTable.version)],
        });
        latestVersion = latest?.version ?? 0;
        await db.insert(featureArchDocRevisionsTable).values({
          id,
          featureId,
          version: latestVersion + 1,
          title: toRevisionTitle(headFeatureRevision.title, kind, payload.title),
          markdown: payload.markdown,
          source: payload.source,
          createdByJobId: createdByJobId ?? null,
          createdAt: now,
        });
        await db
          .update(featureArchDocSpecsTable)
          .set({ headRevisionId: id, updatedAt: now })
          .where(eq(featureArchDocSpecsTable.featureId, featureId));
        break;
      }
      default:
        throw new Error(`Unsupported workstream kind ${kind satisfies never}.`);
    }

    return this.listRevisions(ownerUserId, featureId, kind);
  },

  async getHeadRevision(ownerUserId: string, featureId: string, kind: FeatureWorkstreamKind) {
    const { revisions } = await this.listRevisions(ownerUserId, featureId, kind);
    return revisions[0] ?? null;
  },

  async assertApprovalPrerequisites(
    ownerUserId: string,
    featureId: string,
    kind: FeatureWorkstreamKind,
  ) {
    if (kind === "product") {
      return;
    }

    if (kind === "arch_docs") {
      const techRevision = await this.getHeadRevision(ownerUserId, featureId, "tech");
      if (!techRevision?.approval) {
        throw new HttpError(
          409,
          "approved_feature_tech_required",
          "Approve the feature Tech Spec before approving architecture documentation.",
        );
      }
      return;
    }

    const productRevision = await this.getHeadRevision(ownerUserId, featureId, "product");
    if (!productRevision?.approval) {
      throw new HttpError(
        409,
        "approved_feature_product_required",
        "Approve the feature Product Spec before approving this workstream.",
      );
    }
  },

  async approveRevision(
    ownerUserId: string,
    featureId: string,
    kind: FeatureWorkstreamKind,
    revisionId: string,
  ) {
    const { feature } = await this.getFeatureContext(ownerUserId, featureId);
    await this.assertApprovalPrerequisites(ownerUserId, featureId, kind);
    const { revisions } = await this.listRevisions(ownerUserId, featureId, kind);
    const revision = revisions.find((entry) => entry.id === revisionId);

    if (!revision) {
      throw new HttpError(404, "feature_workstream_revision_not_found", "Revision not found.");
    }

    const existing = await this.getApproval(feature.projectId, kind, revisionId);
    if (!existing) {
      await db.insert(artifactApprovalsTable).values({
        id: generateId(),
        projectId: feature.projectId,
        artifactType: workstreamArtifactTypes[kind],
        artifactId: revisionId,
        approvedByUserId: ownerUserId,
        createdAt: new Date(),
      });
    }

    return this.listRevisions(ownerUserId, featureId, kind);
  },

  async getTracks(ownerUserId: string, featureId: string) {
    await this.getFeatureContext(ownerUserId, featureId);
    const [product, ux, tech, userDocs, archDocs] = await Promise.all([
      this.getHeadRevision(ownerUserId, featureId, "product"),
      this.getHeadRevision(ownerUserId, featureId, "ux"),
      this.getHeadRevision(ownerUserId, featureId, "tech"),
      this.getHeadRevision(ownerUserId, featureId, "user_docs"),
      this.getHeadRevision(ownerUserId, featureId, "arch_docs"),
    ]);

    const requirements = product?.requirements ?? defaultRequirements;
    const toSummary = (
      kind: FeatureWorkstreamKind,
      required: boolean,
      headRevision:
        | Awaited<ReturnType<typeof this.getHeadRevision>>
        | null,
    ): FeatureTrackSummary =>
      featureTrackSummarySchema.parse({
        kind,
        required,
        status: headRevision?.approval ? "approved" : "draft",
        headRevision,
        approvedRevisionId: headRevision?.approval ? headRevision.id : null,
        implementationStatus: "not_implemented",
        isOutOfDate: false,
      });

    return featureTracksResponseSchema.parse({
      featureId,
      tracks: {
        product: toSummary("product", true, product),
        ux: toSummary("ux", requirements.uxRequired, ux),
        tech: toSummary("tech", requirements.techRequired, tech),
        userDocs: toSummary("user_docs", requirements.userDocsRequired, userDocs),
        archDocs: toSummary("arch_docs", requirements.archDocsRequired, archDocs),
      },
    });
  },
});

export type FeatureWorkstreamService = ReturnType<
  typeof createFeatureWorkstreamService
>;
