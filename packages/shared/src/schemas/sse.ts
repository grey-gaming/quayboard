import { z } from "zod";

export const sseConnectedEventSchema = z.object({
  type: z.literal("connected"),
  timestamp: z.string().datetime(),
});

export const sseHeartbeatEventSchema = z.object({
  type: z.literal("heartbeat"),
  timestamp: z.string().datetime(),
});

export const sseEventSchema = z.union([
  sseConnectedEventSchema,
  sseHeartbeatEventSchema,
]);

export type SseEvent = z.infer<typeof sseEventSchema>;
