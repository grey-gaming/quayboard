import { z } from "zod";

import { artifactApprovalSchema } from "./artifacts.js";

export const milestoneStatusSchema = z.enum(["draft", "approved", "completed"]);

export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const planningReviewStatusSchema = z.enum([
  "not_started",
  "passed",
  "failed_first_pass",
  "failed_needs_human",
]);

export type PlanningReviewStatus = z.infer<typeof planningReviewStatusSchema>;

export const milestoneMapReviewIssueSchema = z.object({
  action: z.enum(["rewrite_milestone_map", "needs_human_review"]),
  hint: z.string().min(1),
});

export type MilestoneMapReviewIssue = z.infer<typeof milestoneMapReviewIssueSchema>;

export const milestoneScopeReviewIssueSchema = z.object({
  action: z.enum([
    "rewrite_feature_set",
    "create_catch_up_feature",
    "needs_human_review",
  ]),
  hint: z.string().min(1),
});

export type MilestoneScopeReviewIssue = z.infer<typeof milestoneScopeReviewIssueSchema>;

export const milestoneDeliveryReviewIssueSchema = z.object({
  action: z.enum(["refresh_artifacts", "needs_human_review"]),
  hint: z.string().min(1),
});

export type MilestoneDeliveryReviewIssue = z.infer<
  typeof milestoneDeliveryReviewIssueSchema
>;

export const milestoneMapReviewSchema = z.object({
  generatedAt: z.string().datetime().nullable(),
  reviewStatus: planningReviewStatusSchema,
  reviewIssues: z.array(milestoneMapReviewIssueSchema),
  reviewedAt: z.string().datetime().nullable(),
});

export type MilestoneMapReview = z.infer<typeof milestoneMapReviewSchema>;

export const milestoneLinkedUseCaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
});

export type MilestoneLinkedUseCase = z.infer<typeof milestoneLinkedUseCaseSchema>;

export const milestoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  position: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: milestoneStatusSchema,
  isBootstrapPlaceholder: z.boolean(),
  linkedUserFlows: z.array(milestoneLinkedUseCaseSchema),
  featureCount: z.number().int().nonnegative(),
  isActive: z.boolean(),
  approvedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  scopeReviewStatus: planningReviewStatusSchema,
  scopeReviewIssues: z.array(milestoneScopeReviewIssueSchema),
  scopeReviewedAt: z.string().datetime().nullable(),
  deliveryReviewStatus: planningReviewStatusSchema,
  deliveryReviewIssues: z.array(milestoneDeliveryReviewIssueSchema),
  deliveryReviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Milestone = z.infer<typeof milestoneSchema>;

export const createMilestoneRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(4000),
  useCaseIds: z.array(z.string().uuid()).min(1),
});

export type CreateMilestoneRequest = z.infer<typeof createMilestoneRequestSchema>;

export const updateMilestoneRequestSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().min(1).max(4000).optional(),
  useCaseIds: z.array(z.string().uuid()).min(1).optional(),
});

export type UpdateMilestoneRequest = z.infer<typeof updateMilestoneRequestSchema>;

export const milestoneActionRequestSchema = z.object({
  action: z.enum(["approve", "complete"]),
});

export type MilestoneActionRequest = z.infer<typeof milestoneActionRequestSchema>;

export const milestoneCoverageSummarySchema = z.object({
  approvedUserFlowCount: z.number().int().nonnegative(),
  coveredUserFlowCount: z.number().int().nonnegative(),
  uncoveredUserFlowIds: z.array(z.string().uuid()),
});

export type MilestoneCoverageSummary = z.infer<typeof milestoneCoverageSummarySchema>;

export const milestoneListResponseSchema = z.object({
  milestones: z.array(milestoneSchema),
  coverage: milestoneCoverageSummarySchema,
  mapReview: milestoneMapReviewSchema,
});

export type MilestoneListResponse = z.infer<typeof milestoneListResponseSchema>;

export const milestoneDesignDocSchema = z.object({
  id: z.string().uuid(),
  milestoneId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string().min(1),
  markdown: z.string().min(1),
  source: z.string().min(1),
  isCanonical: z.boolean(),
  createdAt: z.string().datetime(),
  approval: artifactApprovalSchema.nullable(),
});

export type MilestoneDesignDoc = z.infer<typeof milestoneDesignDocSchema>;

export const milestoneDesignDocListResponseSchema = z.object({
  designDocs: z.array(milestoneDesignDocSchema),
});

export type MilestoneDesignDocListResponse = z.infer<typeof milestoneDesignDocListResponseSchema>;

export const updateMilestoneDesignDocRequestSchema = z.object({
  markdown: z.string().trim().min(1),
});

export type UpdateMilestoneDesignDocRequest = z.infer<typeof updateMilestoneDesignDocRequestSchema>;

export const milestoneReconciliationStatusSchema = planningReviewStatusSchema;
export type MilestoneReconciliationStatus = PlanningReviewStatus;
export const milestoneReconciliationIssueSchema = milestoneScopeReviewIssueSchema;
export type MilestoneReconciliationIssue = MilestoneScopeReviewIssue;
