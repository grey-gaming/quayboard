import { z } from "zod";

export const autoAdvanceStatusSchema = z.enum([
  "idle",
  "running",
  "paused",
  "completed",
  "failed",
]);

export type AutoAdvanceStatus = z.infer<typeof autoAdvanceStatusSchema>;

export const autoAdvancePausedReasonSchema = z.enum([
  "quality_gate_blocker",
  "job_failed",
  "policy_mismatch",
  "manual_pause",
  "budget_exceeded",
  "needs_human",
  "milestone_map_repair_limit_reached",
  "milestone_repair_limit_reached",
  "review_limit_reached",
  "ci_fix_budget_exceeded",
  "ci_wait_limit_reached",
]);

export type AutoAdvancePausedReason = z.infer<
  typeof autoAdvancePausedReasonSchema
>;

export const creativityModeSchema = z.enum([
  "conservative",
  "balanced",
  "creative",
]);

export type CreativityMode = z.infer<typeof creativityModeSchema>;

export const autoAdvanceSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: autoAdvanceStatusSchema,
  currentStep: z.string().nullable(),
  pausedReason: autoAdvancePausedReasonSchema.nullable(),
  autoApproveWhenClear: z.boolean(),
  skipReviewSteps: z.boolean(),
  skipHumanReview: z.boolean(),
  autoRepairMilestoneCoverage: z.boolean(),
  creativityMode: creativityModeSchema,
  retryCount: z.number().int(),
  reviewCount: z.number().int(),
  milestoneRepairCount: z.number().int(),
  ciFixCount: z.number().int(),
  ciWaitWindowCount: z.number().int(),
  maxConcurrentJobs: z.number().int(),
  startedAt: z.string().datetime().nullable(),
  pausedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AutoAdvanceSession = z.infer<typeof autoAdvanceSessionSchema>;

export const autoAdvanceStatusResponseSchema = z.object({
  session: autoAdvanceSessionSchema.nullable(),
  nextStep: z.string().nullable(),
});

export type AutoAdvanceStatusResponse = z.infer<
  typeof autoAdvanceStatusResponseSchema
>;

export const startAutoAdvanceRequestSchema = z.object({
  autoApproveWhenClear: z.boolean().optional(),
  skipReviewSteps: z.boolean().optional(),
  skipHumanReview: z.boolean().optional(),
  autoRepairMilestoneCoverage: z.boolean().optional(),
  creativityMode: creativityModeSchema.optional(),
  maxConcurrentJobs: z.number().int().min(1).max(10).optional(),
});

export type StartAutoAdvanceRequest = z.infer<
  typeof startAutoAdvanceRequestSchema
>;
