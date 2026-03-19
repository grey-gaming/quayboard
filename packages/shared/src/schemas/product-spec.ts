import { z } from "zod";

export const productSpecSchema = z.object({
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

export type ProductSpec = z.infer<typeof productSpecSchema>;

export const productSpecListResponseSchema = z.object({
  productSpec: productSpecSchema.nullable(),
});

export const productSpecVersionListResponseSchema = z.object({
  versions: z.array(productSpecSchema),
});

export const updateProductSpecRequestSchema = z.object({
  markdown: z.string().trim().min(1),
});

export type UpdateProductSpecRequest = z.infer<typeof updateProductSpecRequestSchema>;

export const queueProductSpecGenerationRequestSchema = z.object({
  mode: z.enum(["generate", "regenerate", "improve"]),
});

export type QueueProductSpecGenerationRequest = z.infer<
  typeof queueProductSpecGenerationRequestSchema
>;
