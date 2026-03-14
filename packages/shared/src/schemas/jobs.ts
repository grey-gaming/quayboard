import { z } from "zod";

export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const jobSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  type: z.string().min(1),
  status: jobStatusSchema,
  inputs: z.unknown(),
  outputs: z.unknown().nullable(),
  error: z.unknown().nullable(),
  queuedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type Job = z.infer<typeof jobSchema>;

export const jobListResponseSchema = z.object({
  jobs: z.array(jobSchema),
});

export type JobListResponse = z.infer<typeof jobListResponseSchema>;
