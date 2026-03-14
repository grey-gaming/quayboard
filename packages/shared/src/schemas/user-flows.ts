import { z } from "zod";

export const useCaseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  userStory: z.string().min(1),
  entryPoint: z.string().min(1),
  endState: z.string().min(1),
  flowSteps: z.array(z.string().min(1)).min(1),
  coverageTags: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(z.string().min(1)),
  doneCriteriaRefs: z.array(z.string().min(1)),
  source: z.string().min(1),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UseCase = z.infer<typeof useCaseSchema>;

export const upsertUseCaseRequestSchema = useCaseSchema
  .omit({
    id: true,
    projectId: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    source: z.string().min(1).default("manual"),
  });

export type UpsertUseCaseRequest = z.infer<typeof upsertUseCaseRequestSchema>;

export const useCaseListResponseSchema = z.object({
  userFlows: z.array(useCaseSchema),
  coverage: z.object({
    warnings: z.array(z.string().min(1)),
    acceptedWarnings: z.array(z.string().min(1)),
  }),
  approvedAt: z.string().datetime().nullable(),
});

export type UseCaseListResponse = z.infer<typeof useCaseListResponseSchema>;

export const approveUserFlowsRequestSchema = z.object({
  acceptedWarnings: z.array(z.string().min(1)).default([]),
});

export type ApproveUserFlowsRequest = z.infer<
  typeof approveUserFlowsRequestSchema
>;
