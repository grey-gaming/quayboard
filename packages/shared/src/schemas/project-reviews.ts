import { z } from "zod";

export const projectReviewSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type ProjectReviewSeverity = z.infer<typeof projectReviewSeveritySchema>;

export const projectReviewCategorySchema = z.enum([
  "documentation",
  "tests",
  "completeness",
  "architecture",
]);
export type ProjectReviewCategory = z.infer<typeof projectReviewCategorySchema>;

export const projectReviewFindingStatusSchema = z.enum([
  "open",
  "resolved",
  "accepted",
  "ignored",
  "superseded",
]);
export type ProjectReviewFindingStatus = z.infer<typeof projectReviewFindingStatusSchema>;

export const projectReviewSessionStatusSchema = z.enum([
  "queued_review",
  "running_review",
  "queued_fix",
  "running_fix",
  "needs_fixes",
  "clear",
  "failed",
]);
export type ProjectReviewSessionStatus = z.infer<typeof projectReviewSessionStatusSchema>;

export const projectReviewAttemptKindSchema = z.enum(["review", "fix"]);
export type ProjectReviewAttemptKind = z.infer<typeof projectReviewAttemptKindSchema>;

export const projectReviewAttemptStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export type ProjectReviewAttemptStatus = z.infer<typeof projectReviewAttemptStatusSchema>;

export const projectReviewEvidenceSchema = z.object({
  path: z.string().min(1),
});
export type ProjectReviewEvidence = z.infer<typeof projectReviewEvidenceSchema>;

export const projectReviewFindingSchema = z.object({
  id: z.string().uuid(),
  projectReviewAttemptId: z.string().uuid(),
  category: projectReviewCategorySchema,
  severity: projectReviewSeveritySchema,
  finding: z.string().min(1),
  evidence: z.array(projectReviewEvidenceSchema),
  whyItMatters: z.string().min(1),
  recommendedImprovement: z.string().min(1),
  status: projectReviewFindingStatusSchema,
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type ProjectReviewFinding = z.infer<typeof projectReviewFindingSchema>;

export const projectReviewAttemptSummarySchema = z.object({
  executiveSummary: z.string().min(1),
  maturityLevel: z.string().min(1),
  usabilityVerdict: z.string().min(1),
  biggestStrengths: z.array(z.string().min(1)),
  biggestRisks: z.array(z.string().min(1)),
  finalVerdict: z.object({
    documentationGoodEnough: z.boolean(),
    testsGoodEnough: z.boolean(),
    projectCompleteEnough: z.boolean(),
    codeHasMajorIssues: z.boolean(),
    confidence: z.enum(["high", "medium", "low"]),
  }),
});
export type ProjectReviewAttemptSummary = z.infer<typeof projectReviewAttemptSummarySchema>;

export const projectReviewAttemptSchema = z.object({
  id: z.string().uuid(),
  projectReviewSessionId: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: projectReviewAttemptKindSchema,
  status: projectReviewAttemptStatusSchema,
  sequence: z.number().int().positive(),
  sandboxRunId: z.string().uuid().nullable(),
  jobId: z.string().uuid().nullable(),
  reportMarkdown: z.string().nullable(),
  summary: projectReviewAttemptSummarySchema.nullable(),
  findings: z.array(projectReviewFindingSchema),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type ProjectReviewAttempt = z.infer<typeof projectReviewAttemptSchema>;

export const projectReviewSessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: projectReviewSessionStatusSchema,
  loopCount: z.number().int().nonnegative(),
  maxLoops: z.number().int().positive(),
  autoApplyFixes: z.boolean(),
  branchName: z.string().nullable(),
  pullRequestUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  attempts: z.array(projectReviewAttemptSchema),
});
export type ProjectReviewSession = z.infer<typeof projectReviewSessionSchema>;

export const projectReviewListResponseSchema = z.object({
  sessions: z.array(projectReviewSessionSchema),
});
export type ProjectReviewListResponse = z.infer<typeof projectReviewListResponseSchema>;

export const projectReviewDetailResponseSchema = z.object({
  session: projectReviewSessionSchema.nullable(),
});
export type ProjectReviewDetailResponse = z.infer<typeof projectReviewDetailResponseSchema>;

export const startProjectReviewRequestSchema = z.object({
  trigger: z.enum(["manual", "auto_advance"]).default("manual"),
});
export type StartProjectReviewRequest = z.infer<typeof startProjectReviewRequestSchema>;

export const retryProjectReviewFixesRequestSchema = z.object({});
export type RetryProjectReviewFixesRequest = z.infer<typeof retryProjectReviewFixesRequestSchema>;

export const projectReviewPhaseSchema = z.object({
  finalized: z.boolean(),
  latestStatus: projectReviewSessionStatusSchema.nullable(),
  latestSessionId: z.string().uuid().nullable(),
  openFindingsCount: z.number().int().nonnegative(),
});
export type ProjectReviewPhase = z.infer<typeof projectReviewPhaseSchema>;
