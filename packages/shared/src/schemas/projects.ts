import { z } from "zod";

export const projectStateSchema = z.enum([
  "EMPTY",
  "BOOTSTRAPPING",
  "IMPORTING_A",
  "IMPORTING_B",
  "READY_PARTIAL",
  "READY",
]);

export type ProjectState = z.infer<typeof projectStateSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  state: projectStateSchema,
  ownerUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
