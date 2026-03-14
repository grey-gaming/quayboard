import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateProjectRequest, UpsertUseCaseRequest } from "@quayboard/shared";

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

export const useCreateProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => api.createProject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKey });
    },
  });
};

export const useSystemReadinessQuery = () =>
  useQuery({
    queryKey: ["system", "readiness"],
    queryFn: () => api.getSystemReadiness(),
  });

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

export const useUserFlowsQuery = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId, "user-flows"],
    queryFn: () => api.getUserFlows(projectId),
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
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup-status"] });
    },
  });
};

export const useVerifyLlmMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.verifyLlm(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup-status"] });
    },
  });
};

export const useVerifySandboxMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.verifySandbox(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "setup-status"] });
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

export const useGenerateDescriptionMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateDescription(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useGenerateOnePagerMutation = (
  projectId: string,
  mode: "generate" | "regenerate" | "improve",
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateOnePager(projectId, mode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] });
    },
  });
};

export const useApproveOnePagerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.approveOnePager(projectId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "one-pager"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
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

export const useCreateUserFlowMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertUseCaseRequest) => api.createUserFlow(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] });
    },
  });
};

export const useUpdateUserFlowMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload, userFlowId }: { payload: UpsertUseCaseRequest; userFlowId: string }) =>
      api.updateUserFlow(userFlowId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] });
    },
  });
};

export const useDeleteUserFlowMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userFlowId: string) => api.deleteUserFlow(userFlowId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "user-flows"] });
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
      ]);
    },
  });
};
