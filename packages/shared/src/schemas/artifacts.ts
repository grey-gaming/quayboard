import { z } from "zod";

export const artifactTypeSchema = z.enum([
  "blueprint_ux",
  "blueprint_tech",
  "milestone_design_doc",
  "feature_product_revision",
  "feature_ux_revision",
  "feature_tech_revision",
  "feature_user_doc_revision",
  "feature_arch_doc_revision",
]);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactApprovalSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  approvedByUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type ArtifactApproval = z.infer<typeof artifactApprovalSchema>;

export const artifactApprovalStateResponseSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().uuid(),
  approval: artifactApprovalSchema.nullable(),
});

export type ArtifactApprovalStateResponse = z.infer<typeof artifactApprovalStateResponseSchema>;
