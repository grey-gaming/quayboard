import { z } from "zod";

export const questionnaireQuestionKeySchema = z.enum([
  "q1_name_and_description",
  "q2_who_is_it_for",
  "q3_problem_solved",
  "q4_success_looks_like",
  "q5_out_of_scope",
  "q6_main_capabilities",
  "q7_differentiator",
  "q8_typical_usage_flow",
  "q9_platform_and_access",
  "q10_first_user_next_step",
  "q11_constraints_and_requirements",
  "q12_design_references",
  "q13_tech_constraints",
  "q14_product_feel",
]);

export type QuestionnaireQuestionKey = z.infer<
  typeof questionnaireQuestionKeySchema
>;

const answerShape = {
  q1_name_and_description: z.string().max(4000).optional(),
  q2_who_is_it_for: z.string().max(4000).optional(),
  q3_problem_solved: z.string().max(4000).optional(),
  q4_success_looks_like: z.string().max(4000).optional(),
  q5_out_of_scope: z.string().max(4000).optional(),
  q6_main_capabilities: z.string().max(4000).optional(),
  q7_differentiator: z.string().max(4000).optional(),
  q8_typical_usage_flow: z.string().max(4000).optional(),
  q9_platform_and_access: z.string().max(4000).optional(),
  q10_first_user_next_step: z.string().max(4000).optional(),
  q11_constraints_and_requirements: z.string().max(4000).optional(),
  q12_design_references: z.string().max(4000).optional(),
  q13_tech_constraints: z.string().max(4000).optional(),
  q14_product_feel: z.string().max(4000).optional(),
} as const;

export const questionnaireQuestionSchema = z.object({
  key: questionnaireQuestionKeySchema,
  title: z.string().min(1),
  prompt: z.string().min(1),
  helpText: z.string().nullable(),
  order: z.number().int().positive(),
  multiline: z.boolean(),
});

export type QuestionnaireQuestion = z.infer<typeof questionnaireQuestionSchema>;

export const questionnaireAnswerMapSchema = z.object(answerShape);

export const questionnaireAnswersSchema = z.object({
  projectId: z.string().uuid(),
  answers: questionnaireAnswerMapSchema,
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswersSchema>;

export const updateQuestionnaireAnswersRequestSchema = z.object({
  answers: questionnaireAnswerMapSchema,
});

export type UpdateQuestionnaireAnswersRequest = z.infer<
  typeof updateQuestionnaireAnswersRequestSchema
>;

export const questionnaireDefinitionResponseSchema = z.object({
  questions: z.array(questionnaireQuestionSchema),
});

export type QuestionnaireDefinitionResponse = z.infer<
  typeof questionnaireDefinitionResponseSchema
>;
