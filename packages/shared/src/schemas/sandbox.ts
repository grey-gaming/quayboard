import { z } from "zod";

export const executionSettingsSchema = z.object({
  defaultImage: z.string().min(1),
  dockerHost: z.string().nullable(),
  maxConcurrentRuns: z.number().int().positive(),
  defaultTimeoutSeconds: z.number().int().positive(),
  defaultCpuLimit: z.number().positive(),
  defaultMemoryMb: z.number().int().positive(),
});

export type ExecutionSettings = z.infer<typeof executionSettingsSchema>;

export const updateExecutionSettingsRequestSchema = executionSettingsSchema;

export type UpdateExecutionSettingsRequest = z.infer<
  typeof updateExecutionSettingsRequestSchema
>;

export const contextPackTypeSchema = z.enum(["planning", "coding"]);

export type ContextPackType = z.infer<typeof contextPackTypeSchema>;

export const sandboxRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export type SandboxRunStatus = z.infer<typeof sandboxRunStatusSchema>;

export const sandboxRunKindSchema = z.enum([
  "implement",
  "verify",
  "ci_repair",
  "project_review",
  "project_fix",
  "bug_fix",
]);

export type SandboxRunKind = z.infer<typeof sandboxRunKindSchema>;

export const sandboxRunOutcomeSchema = z.enum([
  "changes_applied",
  "no_op",
  "verification_passed",
  "verification_failed",
  "cancelled",
  "error",
]);

export type SandboxRunOutcome = z.infer<typeof sandboxRunOutcomeSchema>;

export const sandboxRunArtifactSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type SandboxRunArtifact = z.infer<typeof sandboxRunArtifactSchema>;

export const sandboxRunEventSchema = z.object({
  id: z.string().uuid(),
  sandboxRunId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  level: z.enum(["info", "warning", "error"]),
  type: z.string().min(1),
  message: z.string().min(1),
  payload: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});

export type SandboxRunEvent = z.infer<typeof sandboxRunEventSchema>;

export const sandboxRunSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  featureId: z.string().uuid().nullable(),
  milestoneId: z.string().uuid().nullable(),
  taskPlanningSessionId: z.string().uuid().nullable(),
  contextPackId: z.string().uuid().nullable(),
  triggeredByJobId: z.string().uuid().nullable(),
  bugReportId: z.string().uuid().nullable(),
  kind: sandboxRunKindSchema,
  status: sandboxRunStatusSchema,
  outcome: sandboxRunOutcomeSchema.nullable(),
  containerId: z.string().nullable(),
  baseCommitSha: z.string().nullable(),
  headCommitSha: z.string().nullable(),
  branchName: z.string().nullable(),
  pullRequestUrl: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  artifacts: z.array(sandboxRunArtifactSchema),
  latestEvent: sandboxRunEventSchema.nullable(),
});

export type SandboxRun = z.infer<typeof sandboxRunSchema>;

export const sandboxRunListResponseSchema = z.object({
  runs: z.array(sandboxRunSchema),
});

export type SandboxRunListResponse = z.infer<typeof sandboxRunListResponseSchema>;

export const sandboxRunDetailResponseSchema = z.object({
  run: sandboxRunSchema,
  events: z.array(sandboxRunEventSchema),
});

export type SandboxRunDetailResponse = z.infer<typeof sandboxRunDetailResponseSchema>;

export const createSandboxRunRequestSchema = z.object({
  featureId: z.string().uuid(),
  kind: z.enum(["implement", "verify"]).default("implement"),
});

export type CreateSandboxRunRequest = z.infer<typeof createSandboxRunRequestSchema>;

export const cancelSandboxRunRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type CancelSandboxRunRequest = z.infer<typeof cancelSandboxRunRequestSchema>;

export const managedContainerSummarySchema = z.object({
  id: z.string().min(1),
  image: z.string().min(1),
  name: z.string().nullable(),
  state: z.string().min(1),
  status: z.string().min(1),
  sandboxRunId: z.string().uuid().nullable(),
  createdAt: z.string().datetime().nullable(),
});

export type ManagedContainerSummary = z.infer<typeof managedContainerSummarySchema>;

export const managedContainerListResponseSchema = z.object({
  containers: z.array(managedContainerSummarySchema),
});

export type ManagedContainerListResponse = z.infer<
  typeof managedContainerListResponseSchema
>;

export const disposeManagedContainerRequestSchema = z.object({
  containerId: z.string().min(1),
});

export type DisposeManagedContainerRequest = z.infer<
  typeof disposeManagedContainerRequestSchema
>;

export const sandboxOptionsSchema = z.object({
  executionSettings: executionSettingsSchema,
  projectRepo: z
    .object({
      owner: z.string().nullable(),
      name: z.string().nullable(),
      repoUrl: z.string().nullable(),
      defaultBranch: z.string().nullable(),
    })
    .nullable(),
  runnableFeatures: z.array(
    z.object({
      id: z.string().uuid(),
      featureKey: z.string().min(1),
      title: z.string().min(1),
      milestoneId: z.string().uuid(),
      milestoneTitle: z.string().min(1),
      hasPendingTasks: z.boolean(),
      latestImplementationRunId: z.string().uuid().nullable(),
      latestImplementationStatus: z.enum([
        "not_implemented",
        "running",
        "implemented",
        "out_of_date",
      ]),
    }),
  ),
  codingPacks: z.array(
    z.object({
      id: z.string().uuid(),
      featureId: z.string().uuid().nullable(),
      type: contextPackTypeSchema,
      version: z.number().int().positive(),
      stale: z.boolean(),
      createdAt: z.string().datetime(),
    }),
  ),
});

export type SandboxOptions = z.infer<typeof sandboxOptionsSchema>;

export const sandboxMilestoneSessionStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export type SandboxMilestoneSessionStatus = z.infer<
  typeof sandboxMilestoneSessionStatusSchema
>;

export const sandboxMilestoneSessionTaskSchema = z.object({
  id: z.string().uuid(),
  sandboxMilestoneSessionId: z.string().uuid(),
  featureId: z.string().uuid(),
  featureTitle: z.string().min(1),
  position: z.number().int().nonnegative(),
  sandboxRunId: z.string().uuid().nullable(),
  status: sandboxMilestoneSessionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SandboxMilestoneSessionTask = z.infer<
  typeof sandboxMilestoneSessionTaskSchema
>;

export const sandboxMilestoneSessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  status: sandboxMilestoneSessionStatusSchema,
  triggeredByJobId: z.string().uuid().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  tasks: z.array(sandboxMilestoneSessionTaskSchema),
});

export type SandboxMilestoneSession = z.infer<
  typeof sandboxMilestoneSessionSchema
>;

export const sandboxMilestoneSessionListResponseSchema = z.object({
  sessions: z.array(sandboxMilestoneSessionSchema),
});

export type SandboxMilestoneSessionListResponse = z.infer<
  typeof sandboxMilestoneSessionListResponseSchema
>;

export const createSandboxMilestoneSessionRequestSchema = z.object({});

export type CreateSandboxMilestoneSessionRequest = z.infer<
  typeof createSandboxMilestoneSessionRequestSchema
>;

export const memoryChunkSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  key: z.string().min(1),
  content: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().nullable(),
  createdByJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type MemoryChunk = z.infer<typeof memoryChunkSchema>;

export const memoryChunkListResponseSchema = z.object({
  chunks: z.array(memoryChunkSchema),
});

export type MemoryChunkListResponse = z.infer<typeof memoryChunkListResponseSchema>;

export const contextPackSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  featureId: z.string().uuid().nullable(),
  type: contextPackTypeSchema,
  version: z.number().int().positive(),
  content: z.string().min(1),
  summary: z.string().min(1),
  stale: z.boolean(),
  omissionList: z.array(z.string()),
  sourceCoverage: z.array(z.string()),
  createdByJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type ContextPack = z.infer<typeof contextPackSchema>;

export const contextPackListResponseSchema = z.object({
  packs: z.array(contextPackSchema),
});

export type ContextPackListResponse = z.infer<typeof contextPackListResponseSchema>;

export const buildContextPackRequestSchema = z.object({
  featureId: z.string().uuid().optional(),
  type: contextPackTypeSchema.default("coding"),
});

export type BuildContextPackRequest = z.infer<typeof buildContextPackRequestSchema>;

export const buildRepoFingerprintRequestSchema = z.object({});

export type BuildRepoFingerprintRequest = z.infer<
  typeof buildRepoFingerprintRequestSchema
>;
