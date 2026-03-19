import { z } from "zod";

export const readinessStatusSchema = z.enum(["pass", "fail", "warn"]);

export const readinessCheckSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: readinessStatusSchema,
  message: z.string().min(1),
});

export type ReadinessCheck = z.infer<typeof readinessCheckSchema>;

export const systemReadinessSchema = z.object({
  checks: z.array(readinessCheckSchema),
});

export type SystemReadiness = z.infer<typeof systemReadinessSchema>;

export const projectSetupStatusSchema = z.object({
  repoConnected: z.boolean(),
  llmVerified: z.boolean(),
  sandboxVerified: z.boolean(),
  checks: z.array(readinessCheckSchema),
});

export type ProjectSetupStatus = z.infer<typeof projectSetupStatusSchema>;
