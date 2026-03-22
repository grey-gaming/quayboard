import { z } from "zod";

import { artifactApprovalSchema } from "./artifacts.js";

export const featureWorkstreamKindSchema = z.enum([
  "product",
  "ux",
  "tech",
  "user_docs",
  "arch_docs",
]);

export type FeatureWorkstreamKind = z.infer<typeof featureWorkstreamKindSchema>;

export const featureWorkstreamStatusSchema = z.enum(["draft", "approved"]);

export type FeatureWorkstreamStatus = z.infer<typeof featureWorkstreamStatusSchema>;

export const featureWorkstreamRequirementsSchema = z.object({
  uxRequired: z.boolean(),
  techRequired: z.boolean(),
  userDocsRequired: z.boolean(),
  archDocsRequired: z.boolean(),
});

export type FeatureWorkstreamRequirements = z.infer<
  typeof featureWorkstreamRequirementsSchema
>;

export const featureWorkstreamRevisionSchema = z.object({
  id: z.string().uuid(),
  featureId: z.string().uuid(),
  kind: featureWorkstreamKindSchema,
  version: z.number().int().positive(),
  title: z.string().min(1),
  markdown: z.string().min(1),
  source: z.string().min(1),
  createdAt: z.string().datetime(),
  approval: artifactApprovalSchema.nullable(),
  requirements: featureWorkstreamRequirementsSchema.nullable(),
});

export type FeatureWorkstreamRevision = z.infer<typeof featureWorkstreamRevisionSchema>;

export const featureWorkstreamRevisionListResponseSchema = z.object({
  revisions: z.array(featureWorkstreamRevisionSchema),
});

export type FeatureWorkstreamRevisionListResponse = z.infer<
  typeof featureWorkstreamRevisionListResponseSchema
>;

export const createFeatureWorkstreamRevisionRequestSchema = z.object({
  markdown: z.string().trim().min(1),
  source: z.string().trim().min(1).default("manual"),
  title: z.string().trim().min(1).max(160).optional(),
});

export type CreateFeatureWorkstreamRevisionRequest = z.infer<
  typeof createFeatureWorkstreamRevisionRequestSchema
>;

export const createFeatureProductRevisionRequestSchema =
  createFeatureWorkstreamRevisionRequestSchema.extend({
    requirements: featureWorkstreamRequirementsSchema.default({
      uxRequired: true,
      techRequired: true,
      userDocsRequired: true,
      archDocsRequired: true,
    }),
  });

export type CreateFeatureProductRevisionRequest = z.infer<
  typeof createFeatureProductRevisionRequestSchema
>;

export const queueFeatureWorkstreamGenerationRequestSchema = z.object({});

export type QueueFeatureWorkstreamGenerationRequest = z.infer<
  typeof queueFeatureWorkstreamGenerationRequestSchema
>;

export const featureTrackSummarySchema = z.object({
  kind: featureWorkstreamKindSchema,
  required: z.boolean(),
  status: featureWorkstreamStatusSchema,
  headRevision: featureWorkstreamRevisionSchema.nullable(),
  approvedRevisionId: z.string().uuid().nullable(),
  implementationStatus: z.literal("not_implemented"),
  isOutOfDate: z.literal(false),
});

export type FeatureTrackSummary = z.infer<typeof featureTrackSummarySchema>;

export const featureTracksResponseSchema = z.object({
  featureId: z.string().uuid(),
  tracks: z.object({
    product: featureTrackSummarySchema.extend({
      kind: z.literal("product"),
      required: z.literal(true),
    }),
    ux: featureTrackSummarySchema.extend({
      kind: z.literal("ux"),
    }),
    tech: featureTrackSummarySchema.extend({
      kind: z.literal("tech"),
    }),
    userDocs: featureTrackSummarySchema.extend({
      kind: z.literal("user_docs"),
    }),
    archDocs: featureTrackSummarySchema.extend({
      kind: z.literal("arch_docs"),
    }),
  }),
});

export type FeatureTracksResponse = z.infer<typeof featureTracksResponseSchema>;
