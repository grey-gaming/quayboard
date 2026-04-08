import { z } from "zod";

export const bugReportStatusSchema = z.enum(["open", "in_progress", "fixed"]);

export type BugReportStatus = z.infer<typeof bugReportStatusSchema>;

export const bugReportSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  featureId: z.string().uuid().nullable(),
  implementationRecordId: z.string().uuid().nullable(),
  description: z.string().min(1),
  status: bugReportStatusSchema,
  reportedByUserId: z.string().uuid(),
  latestFixJobId: z.string().uuid().nullable(),
  latestFixSandboxRunId: z.string().uuid().nullable(),
  latestFixPullRequestUrl: z.string().nullable(),
  lastFixError: z.string().nullable(),
  fixedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BugReport = z.infer<typeof bugReportSchema>;

export const bugListResponseSchema = z.object({
  bugs: z.array(bugReportSchema),
});

export type BugListResponse = z.infer<typeof bugListResponseSchema>;

export const bugDetailResponseSchema = z.object({
  bug: bugReportSchema,
});

export type BugDetailResponse = z.infer<typeof bugDetailResponseSchema>;

export const createBugRequestSchema = z.object({
  featureId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(10_000),
});

export type CreateBugRequest = z.infer<typeof createBugRequestSchema>;

export const updateBugRequestSchema = z.object({
  featureId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
});

export type UpdateBugRequest = z.infer<typeof updateBugRequestSchema>;

export const fixBugRequestSchema = z.object({});

export type FixBugRequest = z.infer<typeof fixBugRequestSchema>;
