import { z } from "zod";

export const secretTypeSchema = z.enum([
  "github_pat",
  "llm_api_key",
  "oauth_token",
]);

export type SecretType = z.infer<typeof secretTypeSchema>;

export const secretMetadataSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: secretTypeSchema,
  maskedIdentifier: z.string().min(1),
  createdAt: z.string().datetime(),
  rotatedAt: z.string().datetime().nullable(),
});

export type SecretMetadata = z.infer<typeof secretMetadataSchema>;

export const createSecretRequestSchema = z.object({
  type: secretTypeSchema,
  value: z.string().min(1),
});

export type CreateSecretRequest = z.infer<typeof createSecretRequestSchema>;

export const updateSecretRequestSchema = z
  .object({
    value: z.string().min(1).optional(),
    revoke: z.boolean().optional(),
  })
  .refine((value) => value.value !== undefined || value.revoke === true, {
    message: "Either value or revoke=true is required.",
    path: ["revoke"],
  });

export type UpdateSecretRequest = z.infer<typeof updateSecretRequestSchema>;

export const secretListResponseSchema = z.object({
  secrets: z.array(secretMetadataSchema),
});

export type SecretListResponse = z.infer<typeof secretListResponseSchema>;
