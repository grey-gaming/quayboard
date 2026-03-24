import { z } from "zod";

export const taskPlanningSessionStatusSchema = z.enum([
  "pending_clarifications",
  "clarifications_generated",
  "clarifications_answered",
  "tasks_generated",
]);

export type TaskPlanningSessionStatus = z.infer<
  typeof taskPlanningSessionStatusSchema
>;

export const taskPlanningSessionSchema = z.object({
  id: z.string().uuid(),
  featureId: z.string().uuid(),
  status: taskPlanningSessionStatusSchema,
  createdByJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TaskPlanningSession = z.infer<typeof taskPlanningSessionSchema>;

export const clarificationStatusSchema = z.enum([
  "pending",
  "answered",
  "skipped",
]);

export type ClarificationStatus = z.infer<typeof clarificationStatusSchema>;

export const taskClarificationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  question: z.string().min(1),
  context: z.string().nullable(),
  status: clarificationStatusSchema,
  answer: z.string().nullable(),
  answerSource: z.string().nullable(),
  answeredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type TaskClarification = z.infer<typeof taskClarificationSchema>;

export const deliveryTaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "blocked",
]);

export type DeliveryTaskStatus = z.infer<typeof deliveryTaskStatusSchema>;

export const deliveryTaskSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().min(1),
  instructions: z.string().nullable(),
  acceptanceCriteria: z.array(z.string().min(1)),
  status: deliveryTaskStatusSchema,
  createdByJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTaskRequestSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  instructions: z.string().max(10000).optional(),
  acceptanceCriteria: z.array(z.string().min(1).max(1000)).optional(),
  status: deliveryTaskStatusSchema.optional(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export const updateTaskRequestSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  instructions: z.string().max(10000).nullable().optional(),
  acceptanceCriteria: z.array(z.string().min(1).max(1000)).optional(),
  status: deliveryTaskStatusSchema.optional(),
});

export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export const taskListResponseSchema = z.object({
  tasks: z.array(deliveryTaskSchema),
});

export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

export const taskIssueSeveritySchema = z.enum([
  "blocker",
  "warning",
  "suggestion",
]);

export type TaskIssueSeverity = z.infer<typeof taskIssueSeveritySchema>;

export const taskIssueStatusSchema = z.enum(["open", "resolved", "ignored"]);

export type TaskIssueStatus = z.infer<typeof taskIssueStatusSchema>;

export const taskIssueSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  severity: taskIssueSeveritySchema,
  category: z.string().min(1),
  description: z.string().min(1),
  status: taskIssueStatusSchema,
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type TaskIssue = z.infer<typeof taskIssueSchema>;

export const implementationRecordSchema = z.object({
  id: z.string().uuid(),
  featureId: z.string().uuid(),
  techRevisionId: z.string().uuid(),
  commitSha: z.string().nullable(),
  sandboxRunId: z.string().nullable(),
  implementedAt: z.string().datetime(),
});

export type ImplementationRecord = z.infer<typeof implementationRecordSchema>;

export const taskPlanningSessionResponseSchema = z.object({
  session: taskPlanningSessionSchema,
  clarifications: z.array(taskClarificationSchema),
  tasks: z.array(deliveryTaskSchema),
});

export type TaskPlanningSessionResponse = z.infer<
  typeof taskPlanningSessionResponseSchema
>;

export const generateClarificationsRequestSchema = z.object({});

export type GenerateClarificationsRequest = z.infer<
  typeof generateClarificationsRequestSchema
>;

export const answerClarificationRequestSchema = z.object({
  answer: z.string().min(1),
});

export type AnswerClarificationRequest = z.infer<
  typeof answerClarificationRequestSchema
>;

export const skipClarificationRequestSchema = z.object({});

export type SkipClarificationRequest = z.infer<
  typeof skipClarificationRequestSchema
>;

export const autoAnswerClarificationsRequestSchema = z.object({});

export type AutoAnswerClarificationsRequest = z.infer<
  typeof autoAnswerClarificationsRequestSchema
>;

export const generateTasksRequestSchema = z.object({});

export type GenerateTasksRequest = z.infer<typeof generateTasksRequestSchema>;

export const createImplementationRecordRequestSchema = z.object({
  techRevisionId: z.string().uuid(),
  commitSha: z.string().optional(),
  sandboxRunId: z.string().optional(),
});

export type CreateImplementationRecordRequest = z.infer<
  typeof createImplementationRecordRequestSchema
>;

export const implementationRecordListResponseSchema = z.object({
  records: z.array(implementationRecordSchema),
});

export type ImplementationRecordListResponse = z.infer<
  typeof implementationRecordListResponseSchema
>;