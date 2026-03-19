import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ArtifactType,
  CreateProjectRequest,
  ProjectSetupState,
  ProjectSetupStatus,
  QueueBlueprintGenerationRequest,
  SaveBlueprintRequest,
  UpdateDecisionCardsRequest,
  UpsertUseCaseRequest,
} from "@quayboard/shared";

import { api } from "../lib/api.js";

export const projectQueryKey = ["projects"];

export const useProjectsQuery = () =>
  useQuery({
    queryKey: projectQueryKey,
    queryFn: () => api.listProjects(),
  });

export const useProjectQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });

export const useProjectSetupQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "setup"],
    queryFn: () => api.getProjectSetup(projectId),
  });

const syncSetupStatusCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  status: ProjectSetupStatus,
) => {
  queryClient.setQueryData<ProjectSetupStatus>(["project", projectId, "setup-status"], status);
  queryClient.setQueryData<ProjectSetupState | undefined>(
    ["project", projectId, "setup"],
    (current) =>
      current
        ? {
            ...current,
            status,
            llm: {
              ...current.llm,
              verified: status.llmVerified,
            },
          }
        : current,
  );
};

export const useCreateProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => api.createProject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKey });
    },
  });
};

export const useCompleteSetupMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.completeSetup(projectId),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", projectId], project);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup-status"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
        queryClient.invalidateQueries({ queryKey: projectQueryKey }),
      ]);
    },
  });
};

export const useSetupStatusQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "setup-status"],
    queryFn: () => api.getSetupStatus(projectId),
  });

export const useQuestionnaireQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "questionnaire"],
    queryFn: () => api.getQuestionnaireAnswers(projectId),
  });

export const useOnePagerQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "one-pager"],
    queryFn: () => api.getOnePager(projectId),
  });

export const useOnePagerVersionsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "one-pager-versions"],
    queryFn: () => api.getOnePagerVersions(projectId),
  });

export const useProductSpecQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "product-spec"],
    queryFn: () => api.getProductSpec(projectId),
  });

export const useProductSpecVersionsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "product-spec-versions"],
    queryFn: () => api.getProductSpecVersions(projectId),
  });

export const useUserFlowsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "user-flows"],
    queryFn: () => api.getUserFlows(projectId),
  });

export const useDecisionCardsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "decision-cards"],
    queryFn: () => api.getDecisionCards(projectId),
  });

export const useBlueprintsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "blueprints"],
    queryFn: () => api.getBlueprints(projectId),
  });

export const useArtifactStateQuery = (
  projectId: string,
  artifactType: ArtifactType,
  artifactId?: string | null,
) =>
  useQuery({
    enabled: Boolean(artifactId),
    queryKey: ["project", projectId, "artifact-state", artifactType, artifactId],
    queryFn: () => api.getArtifactState(projectId, artifactType, artifactId!),
  });

export const useArtifactReviewItemsQuery = (
  projectId: string,
  artifactType: ArtifactType,
  artifactId?: string | null,
) =>
  useQuery({
    enabled: Boolean(artifactId),
    queryKey: ["project", projectId, "artifact-review-items", artifactType, artifactId],
    queryFn: () => api.getArtifactReviewItems(projectId, artifactType, artifactId!),
  });

export const usePhaseGatesQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "phase-gates"],
    queryFn: () => api.getPhaseGates(projectId),
  });

export const useNextActionsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "next-actions"],
    queryFn: () => api.getNextActions(projectId),
  });

export const useProjectJobsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "jobs"],
    queryFn: () => api.getJobs(projectId),
    refetchInterval: 5_000,
  });

export const useUpdateProjectMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.updateProject>[1]) =>
      api.updateProject(projectId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup-status"] }),
        queryClient.invalidateQueries({ queryKey: projectQueryKey }),
      ]);
    },
  });
};

export const useCreateSecretMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { type: string; value: string }) => api.createSecret(projectId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup-status"] }),
      ]);
    },
  });
};

export const useValidateGithubPatMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { pat: string }) => api.validateGithubPat(projectId, payload),
    onSuccess: (setupState) => {
      queryClient.setQueryData<ProjectSetupState>(["project", projectId, "setup"], setupState);
      syncSetupStatusCache(queryClient, projectId, setupState.status);
    },
  });
};

export const useLoadLlmModelsMutation = (projectId: string) =>
  useMutation({
    mutationFn: (payload: { provider: "ollama" }) => api.loadLlmModels(projectId, payload),
  });

export const useVerifyLlmMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.verifyLlm(projectId),
    onSuccess: (status) => {
      syncSetupStatusCache(queryClient, projectId, status);
    },
  });
};

export const useVerifySandboxMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.verifySandbox(projectId),
    onSuccess: (status) => {
      syncSetupStatusCache(queryClient, projectId, status);
    },
  });
};

export const useUpdateQuestionnaireMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answers: Record<string, string>) =>
      api.patchQuestionnaireAnswers(projectId, { answers }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "questionnaire"] });
    },
  });
};

export const useAutoAnswerQuestionnaireMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.autoAnswerQuestionnaire(projectId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "questionnaire"] }),
      ]);
    },
  });
};

export const useGenerateDescriptionMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateDescription(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useGenerateOnePagerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: "generate" | "regenerate" | "improve") =>
      api.generateOnePager(projectId, mode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useApproveOnePagerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.approveOnePager(projectId),
    onSuccess: (project) => {
      const approvedAt = new Date().toISOString();

      queryClient.setQueryData(["project", projectId], project);
      queryClient.setQueryData<{ onePager: { approvedAt: string | null } | null } | undefined>(
        ["project", projectId, "one-pager"],
        (current) =>
          current?.onePager
            ? {
                ...current,
                onePager: {
                  ...current.onePager,
                  approvedAt,
                },
              }
            : current,
      );

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
        queryClient.invalidateQueries({
          queryKey: ["project", projectId, "product-spec"],
        }),
      ]);
    },
  });
};

export const useRestoreOnePagerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: number) => api.restoreOnePagerVersion(projectId, version),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager-versions"] }),
      ]);
    },
  });
};

export const useUpdateOnePagerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { markdown: string }) => api.updateOnePager(projectId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager-versions"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useGenerateProductSpecMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: "generate" | "regenerate" | "improve") =>
      api.generateProductSpec(projectId, mode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useApproveProductSpecMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.approveProductSpec(projectId),
    onSuccess: (productSpec) => {
      queryClient.setQueryData(["project", projectId, "product-spec"], {
        productSpec,
      });
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project", projectId, "product-spec-versions"],
        }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useRestoreProductSpecMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: number) => api.restoreProductSpecVersion(projectId, version),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "product-spec"] }),
        queryClient.invalidateQueries({
          queryKey: ["project", projectId, "product-spec-versions"],
        }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useUpdateProductSpecMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { markdown: string }) => api.updateProductSpec(projectId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "product-spec"] }),
        queryClient.invalidateQueries({
          queryKey: ["project", projectId, "product-spec-versions"],
        }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useCreateUserFlowMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertUseCaseRequest) => api.createUserFlow(projectId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useUpdateUserFlowMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload, userFlowId }: { payload: UpsertUseCaseRequest; userFlowId: string }) =>
      api.updateUserFlow(userFlowId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useDeleteUserFlowMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userFlowId: string) => api.deleteUserFlow(userFlowId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

export const useGenerateUserFlowsMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateUserFlows(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useDedupeUserFlowsMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.runUserFlowDeduplication(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useApproveUserFlowsMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (acceptedWarnings: string[]) => api.approveUserFlows(projectId, acceptedWarnings),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};

const invalidateBlueprintQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "decision-cards"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "blueprints"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "artifact-state"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "artifact-review-items"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
  ]);

export const useGenerateDecisionDeckMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateDecisionDeck(projectId),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};

export const useUpdateDecisionCardsMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDecisionCardsRequest) => api.updateDecisionCards(projectId, payload),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};

export const useGenerateBlueprintMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: QueueBlueprintGenerationRequest) => api.generateBlueprint(projectId, payload),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};

export const useSaveBlueprintMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveBlueprintRequest) => api.saveBlueprint(projectId, payload),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};

export const useRunArtifactReviewMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ artifactId, artifactType }: { artifactId: string; artifactType: ArtifactType }) =>
      api.runArtifactReview(projectId, artifactType, artifactId),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};

export const useUpdateArtifactReviewItemMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewItemId, status }: { reviewItemId: string; status: "DONE" | "ACCEPTED" | "IGNORED" }) =>
      api.updateReviewItem(reviewItemId, status),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};

export const useApproveArtifactMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ artifactId, artifactType }: { artifactId: string; artifactType: ArtifactType }) =>
      api.approveArtifact(projectId, artifactType, artifactId),
    onSuccess: () => {
      void invalidateBlueprintQueries(queryClient, projectId);
    },
  });
};
