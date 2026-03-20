import { z } from "zod";

export const blueprintKindSchema = z.enum(["ux", "tech"]);

export type BlueprintKind = z.infer<typeof blueprintKindSchema>;

export const decisionCardOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
});

export type DecisionCardOption = z.infer<typeof decisionCardOptionSchema>;

export const decisionCardSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: blueprintKindSchema,
  key: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  recommendation: decisionCardOptionSchema,
  alternatives: z.array(decisionCardOptionSchema).min(1),
  selectedOptionId: z.string().min(1).nullable(),
  customSelection: z.string().min(1).nullable(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DecisionCard = z.infer<typeof decisionCardSchema>;

export const decisionCardListResponseSchema = z.object({
  cards: z.array(decisionCardSchema),
});

export type DecisionCardListResponse = z.infer<typeof decisionCardListResponseSchema>;

export const updateDecisionCardSelectionSchema = z
  .object({
    id: z.string().uuid(),
    selectedOptionId: z.string().min(1).nullable().optional(),
    customSelection: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasSelectedOption = typeof value.selectedOptionId === "string" && value.selectedOptionId.length > 0;
    const hasCustomSelection = typeof value.customSelection === "string" && value.customSelection.length > 0;

    if (!hasSelectedOption && !hasCustomSelection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a selected option or a custom selection.",
      });
    }
  });

export type UpdateDecisionCardSelection = z.infer<typeof updateDecisionCardSelectionSchema>;

export const updateDecisionCardsRequestSchema = z.object({
  cards: z.array(updateDecisionCardSelectionSchema).min(1),
});

export type UpdateDecisionCardsRequest = z.infer<typeof updateDecisionCardsRequestSchema>;

export const queueDecisionDeckGenerationRequestSchema = z.object({
  kind: blueprintKindSchema,
});

export type QueueDecisionDeckGenerationRequest = z.infer<
  typeof queueDecisionDeckGenerationRequestSchema
>;

export const projectBlueprintSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: blueprintKindSchema,
  version: z.number().int().positive(),
  title: z.string().min(1),
  markdown: z.string().min(1),
  source: z.string().min(1),
  isCanonical: z.boolean(),
  createdAt: z.string().datetime(),
});

export type ProjectBlueprint = z.infer<typeof projectBlueprintSchema>;

export const canonicalBlueprintsResponseSchema = z.object({
  uxBlueprint: projectBlueprintSchema.nullable(),
  techBlueprint: projectBlueprintSchema.nullable(),
});

export type CanonicalBlueprintsResponse = z.infer<typeof canonicalBlueprintsResponseSchema>;

export const projectBlueprintListResponseSchema = z.object({
  blueprint: projectBlueprintSchema.nullable(),
});

export type ProjectBlueprintListResponse = z.infer<typeof projectBlueprintListResponseSchema>;

export const projectBlueprintVersionListResponseSchema = z.object({
  versions: z.array(projectBlueprintSchema),
});

export type ProjectBlueprintVersionListResponse = z.infer<
  typeof projectBlueprintVersionListResponseSchema
>;

export const queueBlueprintGenerationRequestSchema = z.object({
  kind: blueprintKindSchema,
});

export type QueueBlueprintGenerationRequest = z.infer<typeof queueBlueprintGenerationRequestSchema>;

export const saveBlueprintRequestSchema = z.object({
  kind: blueprintKindSchema,
  title: z.string().trim().min(1),
  markdown: z.string().trim().min(1),
});

export type SaveBlueprintRequest = z.infer<typeof saveBlueprintRequestSchema>;
