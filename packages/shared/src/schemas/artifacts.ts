import { z } from "zod";

export const artifactTypeSchema = z.enum(["blueprint_ux", "blueprint_tech"]);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactReviewRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export type ArtifactReviewRunStatus = z.infer<typeof artifactReviewRunStatusSchema>;

export const reviewItemSeveritySchema = z.enum(["BLOCKER", "WARNING", "SUGGESTION"]);

export type ReviewItemSeverity = z.infer<typeof reviewItemSeveritySchema>;

export const reviewItemStatusSchema = z.enum(["OPEN", "DONE", "ACCEPTED", "IGNORED"]);

export type ReviewItemStatus = z.infer<typeof reviewItemStatusSchema>;

export const artifactReviewRunSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
  status: artifactReviewRunStatusSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type ArtifactReviewRun = z.infer<typeof artifactReviewRunSchema>;

export const artifactReviewItemSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  reviewRunId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  severity: reviewItemSeveritySchema,
  category: z.string().min(1),
  title: z.string().min(1),
  details: z.string().min(1),
  status: reviewItemStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ArtifactReviewItem = z.infer<typeof artifactReviewItemSchema>;

export const artifactApprovalSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  approvedByUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type ArtifactApproval = z.infer<typeof artifactApprovalSchema>;

export const artifactStateResponseSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  latestReviewRun: artifactReviewRunSchema.nullable(),
  reviewItems: z.array(artifactReviewItemSchema),
  openBlockerCount: z.number().int().nonnegative(),
  openWarningCount: z.number().int().nonnegative(),
  openSuggestionCount: z.number().int().nonnegative(),
  approval: artifactApprovalSchema.nullable(),
});

export type ArtifactStateResponse = z.infer<typeof artifactStateResponseSchema>;

export const artifactReviewItemsResponseSchema = z.object({
  items: z.array(artifactReviewItemSchema),
});

export type ArtifactReviewItemsResponse = z.infer<typeof artifactReviewItemsResponseSchema>;

export const updateArtifactReviewItemRequestSchema = z.object({
  status: reviewItemStatusSchema.exclude(["OPEN"]),
});

export type UpdateArtifactReviewItemRequest = z.infer<
  typeof updateArtifactReviewItemRequestSchema
>;
