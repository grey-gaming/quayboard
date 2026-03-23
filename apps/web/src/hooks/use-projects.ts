import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ArtifactType,
  BlueprintKind,
  CreateProjectRequest,
  ProjectSetupState,
  ProjectSetupStatus,
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

const specQueryKey = (projectId: string, kind: BlueprintKind) => [
  "project",
  projectId,
  `${kind}-spec`,
] as const;

const specVersionsQueryKey = (projectId: string, kind: BlueprintKind) => [
  "project",
  projectId,
  `${kind}-spec-versions`,
] as const;

const specDecisionTilesQueryKey = (projectId: string, kind: BlueprintKind) => [
  "project",
  projectId,
  `${kind}-decision-tiles`,
] as const;

export const useSpecDecisionTilesQuery = (projectId: string, kind: BlueprintKind) =>
  useQuery({
    queryKey: specDecisionTilesQueryKey(projectId, kind),
    queryFn: () => api.getSpecDecisionTiles(projectId, kind),
  });

export const useProjectSpecQuery = (projectId: string, kind: BlueprintKind) =>
  useQuery({
    queryKey: specQueryKey(projectId, kind),
    queryFn: () => api.getProjectSpec(projectId, kind),
  });

export const useProjectSpecVersionsQuery = (projectId: string, kind: BlueprintKind) =>
  useQuery({
    queryKey: specVersionsQueryKey(projectId, kind),
    queryFn: () => api.getProjectSpecVersions(projectId, kind),
  });

export const useArtifactApprovalQuery = (
  projectId: string,
  artifactType: ArtifactType,
  artifactId?: string | null,
) =>
  useQuery({
    enabled: Boolean(artifactId),
    queryKey: ["project", projectId, "artifact-approval", artifactType, artifactId],
    queryFn: () => api.getArtifactApprovalState(projectId, artifactType, artifactId!),
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

export const useMilestonesQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "milestones"],
    queryFn: () => api.getMilestones(projectId),
  });

export const useMilestoneDesignDocsQuery = (milestoneId?: string | null) =>
  useQuery({
    enabled: Boolean(milestoneId),
    queryKey: ["milestone", milestoneId, "design-docs"],
    queryFn: () => api.getMilestoneDesignDocs(milestoneId!),
  });

export const useFeaturesQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "features"],
    queryFn: () => api.getFeatures(projectId),
  });

export const useFeatureQuery = (featureId: string) =>
  useQuery({
    enabled: Boolean(featureId),
    queryKey: ["feature", featureId],
    queryFn: () => api.getFeature(featureId),
  });

export const useFeatureGraphQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "features-graph"],
    queryFn: () => api.getFeatureGraph(projectId),
  });

export const useFeatureRollupQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "features-rollup"],
    queryFn: () => api.getFeatureRollup(projectId),
  });

const featureTracksQueryKey = (featureId: string) => ["feature", featureId, "tracks"] as const;
const featureWorkstreamRevisionsQueryKey = (
  featureId: string,
  kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
) => ["feature", featureId, `${kind}-revisions`] as const;

export const useFeatureTracksQuery = (featureId: string) =>
  useQuery({
    enabled: Boolean(featureId),
    queryKey: featureTracksQueryKey(featureId),
    queryFn: () => api.getFeatureTracks(featureId),
  });

export const useFeatureWorkstreamRevisionsQuery = (
  featureId: string,
  kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs",
) =>
  useQuery({
    enabled: Boolean(featureId),
    queryKey: featureWorkstreamRevisionsQueryKey(featureId, kind),
    queryFn: () => api.getFeatureWorkstreamRevisions(featureId, kind),
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

const invalidateProjectSpecQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  kind?: BlueprintKind,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] }),
    ...(kind
      ? [
          queryClient.invalidateQueries({ queryKey: specDecisionTilesQueryKey(projectId, kind) }),
          queryClient.invalidateQueries({ queryKey: specQueryKey(projectId, kind) }),
          queryClient.invalidateQueries({ queryKey: specVersionsQueryKey(projectId, kind) }),
        ]
      : [
          queryClient.invalidateQueries({ queryKey: specDecisionTilesQueryKey(projectId, "ux") }),
          queryClient.invalidateQueries({ queryKey: specDecisionTilesQueryKey(projectId, "tech") }),
          queryClient.invalidateQueries({ queryKey: specQueryKey(projectId, "ux") }),
          queryClient.invalidateQueries({ queryKey: specQueryKey(projectId, "tech") }),
          queryClient.invalidateQueries({ queryKey: specVersionsQueryKey(projectId, "ux") }),
          queryClient.invalidateQueries({ queryKey: specVersionsQueryKey(projectId, "tech") }),
        ]),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "artifact-approval"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
  ]);

export const useGenerateSpecDecisionTilesMutation = (projectId: string, kind: BlueprintKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateSpecDecisionTiles(projectId, kind),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId, kind);
    },
  });
};

export const useUpdateSpecDecisionTilesMutation = (projectId: string, kind: BlueprintKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDecisionCardsRequest) =>
      api.updateSpecDecisionTiles(projectId, kind, payload),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId, kind);
    },
  });
};

export const useAcceptSpecDecisionTilesMutation = (projectId: string, kind: BlueprintKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.acceptSpecDecisionTiles(projectId, kind),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId, kind);
    },
  });
};

export const useGenerateProjectSpecMutation = (projectId: string, kind: BlueprintKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateProjectSpec(projectId, kind),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId, kind);
    },
  });
};

export const useRestoreProjectSpecMutation = (projectId: string, kind: BlueprintKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: number) => api.restoreProjectSpecVersion(projectId, kind, version),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId, kind);
    },
  });
};

export const useSaveProjectSpecMutation = (projectId: string, kind: BlueprintKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { markdown: string; title: string }) =>
      api.saveProjectSpec(projectId, kind, payload),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId, kind);
    },
  });
};

export const useApproveArtifactMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ artifactId, artifactType }: { artifactId: string; artifactType: ArtifactType }) =>
      api.approveArtifact(projectId, artifactType, artifactId),
    onSuccess: () => {
      void invalidateProjectSpecQueries(queryClient, projectId);
    },
  });
};

const invalidateMilestoneFeatureQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  milestoneId?: string | null,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "milestones"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "features"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "features-graph"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "features-rollup"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
    queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
    ...(milestoneId
      ? [queryClient.invalidateQueries({ queryKey: ["milestone", milestoneId, "design-docs"] })]
      : []),
  ]);

const invalidateFeatureWorkstreamQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  featureId: string,
) =>
  Promise.all([
    invalidateMilestoneFeatureQueries(queryClient, projectId),
    queryClient.invalidateQueries({ queryKey: featureTracksQueryKey(featureId) }),
    queryClient.invalidateQueries({
      queryKey: featureWorkstreamRevisionsQueryKey(featureId, "product"),
    }),
    queryClient.invalidateQueries({
      queryKey: featureWorkstreamRevisionsQueryKey(featureId, "ux"),
    }),
    queryClient.invalidateQueries({
      queryKey: featureWorkstreamRevisionsQueryKey(featureId, "tech"),
    }),
    queryClient.invalidateQueries({
      queryKey: featureWorkstreamRevisionsQueryKey(featureId, "user_docs"),
    }),
    queryClient.invalidateQueries({
      queryKey: featureWorkstreamRevisionsQueryKey(featureId, "arch_docs"),
    }),
  ]);

export const useCreateMilestoneMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createMilestone>[1]) =>
      api.createMilestone(projectId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useUpdateMilestoneMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      payload,
    }: {
      milestoneId: string;
      payload: Parameters<typeof api.updateMilestone>[1];
    }) => api.updateMilestone(milestoneId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useTransitionMilestoneMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      milestoneId,
      action,
    }: {
      milestoneId: string;
      action: "approve";
    }) => api.transitionMilestone(milestoneId, action),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useGenerateMilestonesMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateMilestones(projectId),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useGenerateMilestoneDesignMutation = (
  projectId: string,
  milestoneId: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateMilestoneDesignDoc(milestoneId),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId, milestoneId);
    },
  });
};

export const useApproveMilestoneDesignMutation = (
  projectId: string,
  milestoneId: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (revisionId: string) => api.approveMilestoneDesignDoc(milestoneId, revisionId),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId, milestoneId);
    },
  });
};

export const useUpdateMilestoneDesignMutation = (
  projectId: string,
  milestoneId: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { markdown: string }) => api.updateMilestoneDesignDoc(milestoneId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId, milestoneId);
    },
  });
};

export const useCreateFeatureMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createFeature>[1]) =>
      api.createFeature(projectId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useAppendFeaturesFromOnePagerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.appendFeaturesFromOnePager>[1]) =>
      api.appendFeaturesFromOnePager(projectId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useUpdateFeatureMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      payload,
    }: {
      featureId: string;
      payload: Parameters<typeof api.updateFeature>[1];
    }) => api.updateFeature(featureId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useArchiveFeatureMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (featureId: string) => api.archiveFeature(featureId),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useCreateFeatureRevisionMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      payload,
    }: {
      featureId: string;
      payload: Parameters<typeof api.createFeatureRevision>[1];
    }) => api.createFeatureRevision(featureId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useAddFeatureDependencyMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      payload,
    }: {
      featureId: string;
      payload: Parameters<typeof api.addFeatureDependency>[1];
    }) => api.addFeatureDependency(featureId, payload),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useRemoveFeatureDependencyMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      dependsOnFeatureId,
    }: {
      featureId: string;
      dependsOnFeatureId: string;
    }) => api.removeFeatureDependency(featureId, dependsOnFeatureId),
    onSuccess: () => {
      void invalidateMilestoneFeatureQueries(queryClient, projectId);
    },
  });
};

export const useCreateFeatureWorkstreamRevisionMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      kind,
      payload,
    }: {
      featureId: string;
      kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs";
      payload: Parameters<typeof api.createFeatureWorkstreamRevision>[2];
    }) => api.createFeatureWorkstreamRevision(featureId, kind, payload),
    onSuccess: (_data, variables) => {
      void invalidateFeatureWorkstreamQueries(queryClient, projectId, variables.featureId);
    },
  });
};

export const useGenerateFeatureWorkstreamRevisionMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      kind,
    }: {
      featureId: string;
      kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs";
    }) => api.generateFeatureWorkstreamRevision(featureId, kind),
    onSuccess: (_data, variables) => {
      void invalidateFeatureWorkstreamQueries(queryClient, projectId, variables.featureId);
    },
  });
};

export const useApproveFeatureWorkstreamRevisionMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureId,
      kind,
      revisionId,
    }: {
      featureId: string;
      kind: "product" | "ux" | "tech" | "user_docs" | "arch_docs";
      revisionId: string;
    }) => api.approveFeatureWorkstreamRevision(featureId, kind, revisionId),
    onSuccess: (_data, variables) => {
      void invalidateFeatureWorkstreamQueries(queryClient, projectId, variables.featureId);
    },
  });
};
