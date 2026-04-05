import { z } from "zod";

export const MAX_PROJECT_DESCRIPTION_WORDS = 500;

const countWords = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
};

export const projectDescriptionSchema = z
  .string()
  .trim()
  .refine(
    (value) => countWords(value) <= MAX_PROJECT_DESCRIPTION_WORDS,
    `Description must not have more than ${MAX_PROJECT_DESCRIPTION_WORDS} words.`,
  );

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
  milestonePlanStatus: z.enum(["open", "finalized"]),
  milestonePlanFinalizedAt: z.string().datetime().nullable(),
  ownerUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: projectDescriptionSchema.optional().nullable(),
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
