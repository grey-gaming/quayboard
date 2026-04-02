import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api.js";

export const useExecutionSettingsQuery = () =>
  useQuery({
    queryKey: ["settings", "execution"],
    queryFn: () => api.getExecutionSettings(),
  });

export const useUpdateExecutionSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.updateExecutionSettings>[0]) =>
      api.updateExecutionSettings(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "execution"] });
    },
  });
};

export const useSandboxOptionsQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "sandbox-options"],
    queryFn: () => api.getSandboxOptions(projectId),
  });

export const useSandboxRunsQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "sandbox-runs"],
    queryFn: () => api.getSandboxRuns(projectId),
    refetchInterval: 5_000,
  });

export const useSandboxRunQuery = (runId?: string | null) =>
  useQuery({
    enabled: Boolean(runId),
    queryKey: ["sandbox-run", runId],
    queryFn: () => api.getSandboxRun(runId!),
    refetchInterval: 5_000,
  });

export const useCreateSandboxRunMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createSandboxRun>[1]) =>
      api.createSandboxRun(projectId, payload),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "sandbox-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "sandbox-options"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "jobs"] }),
      ]);
    },
  });
};

export const useCancelSandboxRunMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason?: string }) =>
      api.cancelSandboxRun(runId, reason ? { reason } : undefined),
    onSuccess: (_, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "sandbox-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["sandbox-run", variables.runId] }),
      ]);
    },
  });
};

export const useManagedContainersQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "sandbox-containers"],
    queryFn: () => api.listManagedContainers(projectId),
    refetchInterval: 5_000,
  });

export const useDisposeManagedContainerMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (containerId: string) => api.disposeManagedContainer(projectId, containerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project", projectId, "sandbox-containers"],
      });
    },
  });
};

export const useSandboxMilestoneSessionsQuery = (milestoneId?: string | null) =>
  useQuery({
    enabled: Boolean(milestoneId),
    queryKey: ["milestone", milestoneId, "sandbox-sessions"],
    queryFn: () => api.listSandboxMilestoneSessions(milestoneId!),
    refetchInterval: 5_000,
  });

export const useCreateSandboxMilestoneSessionMutation = (milestoneId?: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.createSandboxMilestoneSession(milestoneId!),
    onSuccess: () => {
      if (!milestoneId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: ["milestone", milestoneId, "sandbox-sessions"],
      });
    },
  });
};

export const useContextPacksQuery = (projectId: string, featureId?: string | null) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "context-packs", featureId ?? null],
    queryFn: () => api.listContextPacks(projectId, featureId ?? undefined),
  });

export const useBuildContextPackMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { featureId?: string; type?: "planning" | "coding" }) =>
      api.buildContextPack(projectId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["project", projectId, "context-packs", variables.featureId ?? null],
      });
      void queryClient.invalidateQueries({
        queryKey: ["project", projectId, "sandbox-options"],
      });
    },
  });
};

export const useMemoryChunksQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "memory-chunks"],
    queryFn: () => api.getMemoryChunks(projectId),
  });
