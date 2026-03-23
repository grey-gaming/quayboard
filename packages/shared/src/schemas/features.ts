import { z } from "zod";

export const featureStatusSchema = z.enum([
  "draft",
  "approved",
  "in_progress",
  "completed",
  "archived",
]);

export type FeatureStatus = z.infer<typeof featureStatusSchema>;

export const featureKindSchema = z.enum([
  "screen",
  "menu",
  "dialog",
  "system",
  "service",
  "library",
  "pipeline",
  "placeholder_visual",
  "placeholder_non_visual",
]);

export type FeatureKind = z.infer<typeof featureKindSchema>;

export const prioritySchema = z.enum([
  "must_have",
  "should_have",
  "could_have",
  "wont_have",
]);

export type Priority = z.infer<typeof prioritySchema>;

export const featureRevisionSchema = z.object({
  id: z.string().uuid(),
  featureId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  source: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type FeatureRevision = z.infer<typeof featureRevisionSchema>;

export const featureDependencySchema = z.object({
  featureId: z.string().uuid(),
  dependsOnFeatureId: z.string().uuid(),
});

export type FeatureDependency = z.infer<typeof featureDependencySchema>;

export const featureDocumentStateSchema = z.enum(["missing", "draft", "accepted"]);

export type FeatureDocumentState = z.infer<typeof featureDocumentStateSchema>;

export const featureDocumentSummarySchema = z.object({
  required: z.boolean(),
  state: featureDocumentStateSchema,
});

export type FeatureDocumentSummary = z.infer<typeof featureDocumentSummarySchema>;

export const featureDocumentsSchema = z.object({
  product: featureDocumentSummarySchema,
  ux: featureDocumentSummarySchema,
  tech: featureDocumentSummarySchema,
  userDocs: featureDocumentSummarySchema,
  archDocs: featureDocumentSummarySchema,
});

export type FeatureDocuments = z.infer<typeof featureDocumentsSchema>;

export const featureSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  milestoneTitle: z.string().min(1),
  featureKey: z.string().min(1),
  kind: featureKindSchema,
  priority: prioritySchema,
  status: featureStatusSchema,
  headRevision: featureRevisionSchema,
  documents: featureDocumentsSchema,
  dependencyIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type Feature = z.infer<typeof featureSchema>;

export const createFeatureRequestSchema = z.object({
  milestoneId: z.string().uuid(),
  kind: featureKindSchema,
  priority: prioritySchema,
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(4000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).min(1),
  source: z.string().trim().min(1).default("manual"),
});

export type CreateFeatureRequest = z.infer<typeof createFeatureRequestSchema>;

export const updateFeatureRequestSchema = z.object({
  milestoneId: z.string().uuid().optional(),
  kind: featureKindSchema.optional(),
  priority: prioritySchema.optional(),
  status: featureStatusSchema.exclude(["archived"]).optional(),
});

export type UpdateFeatureRequest = z.infer<typeof updateFeatureRequestSchema>;

export const createFeatureRevisionRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(4000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).min(1),
  source: z.string().trim().min(1).default("manual"),
});

export type CreateFeatureRevisionRequest = z.infer<typeof createFeatureRevisionRequestSchema>;

export const createFeatureDependencyRequestSchema = z.object({
  dependsOnFeatureId: z.string().uuid(),
});

export type CreateFeatureDependencyRequest = z.infer<typeof createFeatureDependencyRequestSchema>;

export const appendFeatureFromOnePagerRequestSchema = z.object({
  milestoneId: z.string().uuid(),
});

export type AppendFeatureFromOnePagerRequest = z.infer<
  typeof appendFeatureFromOnePagerRequestSchema
>;

export const featureListResponseSchema = z.object({
  features: z.array(featureSchema),
});

export type FeatureListResponse = z.infer<typeof featureListResponseSchema>;

export const featureRevisionListResponseSchema = z.object({
  revisions: z.array(featureRevisionSchema),
});

export type FeatureRevisionListResponse = z.infer<typeof featureRevisionListResponseSchema>;

export const featureDependencyListResponseSchema = z.object({
  dependencies: z.array(featureDependencySchema),
});

export type FeatureDependencyListResponse = z.infer<typeof featureDependencyListResponseSchema>;

export const featureGraphNodeSchema = z.object({
  featureId: z.string().uuid(),
  featureKey: z.string().min(1),
  milestoneId: z.string().uuid(),
  milestoneTitle: z.string().min(1),
  title: z.string().min(1),
  kind: featureKindSchema,
  priority: prioritySchema,
  status: featureStatusSchema,
});

export type FeatureGraphNode = z.infer<typeof featureGraphNodeSchema>;

export const featureGraphEdgeSchema = z.object({
  featureId: z.string().uuid(),
  dependsOnFeatureId: z.string().uuid(),
  type: z.literal("depends_on"),
});

export type FeatureGraphEdge = z.infer<typeof featureGraphEdgeSchema>;

export const featureGraphResponseSchema = z.object({
  nodes: z.array(featureGraphNodeSchema),
  edges: z.array(featureGraphEdgeSchema),
});

export type FeatureGraphResponse = z.infer<typeof featureGraphResponseSchema>;

export const featureRollupCountSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const featureRollupResponseSchema = z.object({
  totals: z.object({
    active: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative(),
  }),
  byStatus: z.array(featureRollupCountSchema),
  byKind: z.array(featureRollupCountSchema),
  byPriority: z.array(featureRollupCountSchema),
  byMilestone: z.array(
    z.object({
      milestoneId: z.string().uuid(),
      milestoneTitle: z.string().min(1),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export type FeatureRollupResponse = z.infer<typeof featureRollupResponseSchema>;
