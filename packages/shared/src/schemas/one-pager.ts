import { z } from "zod";

export const onePagerSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string().min(1),
  markdown: z.string().min(1),
  source: z.string().min(1),
  isCanonical: z.boolean(),
  approvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type OnePager = z.infer<typeof onePagerSchema>;

export const onePagerListResponseSchema = z.object({
  onePager: onePagerSchema.nullable(),
});

export const onePagerVersionListResponseSchema = z.object({
  versions: z.array(onePagerSchema),
});

export const updateOnePagerRequestSchema = z.object({
  markdown: z.string().trim().min(1),
});

export type UpdateOnePagerRequest = z.infer<typeof updateOnePagerRequestSchema>;

export const restoreOnePagerVersionRequestSchema = z.object({
  approve: z.boolean().optional(),
});

export const queueOnePagerGenerationRequestSchema = z.object({
  mode: z.enum(["generate", "regenerate", "improve"]),
  instructions: z.string().max(4000).optional(),
});

export type QueueOnePagerGenerationRequest = z.infer<
  typeof queueOnePagerGenerationRequestSchema
>;
