import { z } from "zod";

import { jobSchema } from "./jobs.js";
import { sandboxRunSchema } from "./sandbox.js";

export const liveTraceConnectionStatusSchema = z.enum([
  "live",
  "lagging",
  "reconnecting",
]);

export type LiveTraceConnectionStatus = z.infer<typeof liveTraceConnectionStatusSchema>;

export const liveOutputLinkSchema = z.object({
  kind: z.enum([
    "one_pager",
    "product_spec",
    "project_blueprint",
    "milestone_design_doc",
    "feature_revision",
    "task_session",
    "sandbox_run",
    "project_review",
    "bug_report",
  ]),
  label: z.string().min(1),
  href: z.string().min(1),
});

export type LiveOutputLink = z.infer<typeof liveOutputLinkSchema>;

export const liveChangedFileSchema = z.object({
  path: z.string().min(1),
  additions: z.number().int().nonnegative().nullable(),
  deletions: z.number().int().nonnegative().nullable(),
  binary: z.boolean().default(false),
});

export type LiveChangedFile = z.infer<typeof liveChangedFileSchema>;

export const liveToolCallSchema = z.object({
  id: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  inputPreview: z.string().nullable(),
  outputPreview: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export type LiveToolCall = z.infer<typeof liveToolCallSchema>;

export const liveLlmStepSummarySchema = z.object({
  key: z.string().min(1),
  templateId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["running", "succeeded", "failed"]),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  promptTokens: z.number().int().nonnegative().nullable(),
  completionTokens: z.number().int().nonnegative().nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
});

export type LiveLlmStepSummary = z.infer<typeof liveLlmStepSummarySchema>;

export const liveTraceEventTypeSchema = z.enum([
  "job_status",
  "llm_step_started",
  "llm_step_finished",
  "text_delta",
  "reasoning_delta",
  "tool_call_started",
  "tool_call_finished",
  "changed_files",
  "sandbox_event",
  "output_link",
  "error",
]);

export type LiveTraceEventType = z.infer<typeof liveTraceEventTypeSchema>;

export const liveTraceEventSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  type: liveTraceEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export type LiveTraceEvent = z.infer<typeof liveTraceEventSchema>;

export const liveJobTraceSnapshotSchema = z.object({
  job: jobSchema,
  events: z.array(liveTraceEventSchema),
  changedFiles: z.array(liveChangedFileSchema),
  toolCalls: z.array(liveToolCallSchema),
  llmSteps: z.array(liveLlmStepSummarySchema),
  outputLinks: z.array(liveOutputLinkSchema),
  transcript: z.object({
    output: z.string(),
    reasoning: z.string(),
  }),
  relatedSandboxRun: sandboxRunSchema.nullable(),
  latestSequence: z.number().int().nonnegative(),
});

export type LiveJobTraceSnapshot = z.infer<typeof liveJobTraceSnapshotSchema>;

export const liveJobTraceResponseSchema = z.object({
  snapshot: liveJobTraceSnapshotSchema,
});

export type LiveJobTraceResponse = z.infer<typeof liveJobTraceResponseSchema>;

export const liveJobDiffResponseSchema = z.object({
  path: z.string().min(1),
  patch: z.string(),
});

export type LiveJobDiffResponse = z.infer<typeof liveJobDiffResponseSchema>;
