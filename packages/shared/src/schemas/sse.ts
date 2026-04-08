import { z } from "zod";

export const sseConnectedEventSchema = z.object({
  type: z.literal("connected"),
  timestamp: z.string().datetime(),
});

export const sseHeartbeatEventSchema = z.object({
  type: z.literal("heartbeat"),
  timestamp: z.string().datetime(),
});

export const sseJobUpdatedEventSchema = z.object({
  type: z.literal("job:updated"),
  jobId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  status: z.string().min(1),
});

export const sseProjectUpdatedEventSchema = z.object({
  type: z.literal("project:updated"),
  projectId: z.string().uuid(),
  resource: z.enum(["feature", "milestone", "phase_gates", "project_review", "bug"]),
});

export const sseJobTraceEventSchema = z.object({
  type: z.literal("job:trace"),
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  event: z.object({
    sequence: z.number().int().nonnegative(),
    type: z.string().min(1),
    createdAt: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()),
  }),
});

export const sseEventSchema = z.union([
  sseConnectedEventSchema,
  sseHeartbeatEventSchema,
  sseJobUpdatedEventSchema,
  sseProjectUpdatedEventSchema,
  sseJobTraceEventSchema,
]);

export type SseEvent = z.infer<typeof sseEventSchema>;
