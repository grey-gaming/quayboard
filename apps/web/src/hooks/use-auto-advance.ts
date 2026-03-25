import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StartAutoAdvanceRequest } from "@quayboard/shared";

import { missionControlApi } from "../lib/mission-control-api.js";

const autoAdvanceKey = (projectId: string) => [
  "project",
  projectId,
  "auto-advance",
];

export const useAutoAdvanceQuery = (projectId: string) =>
  useQuery({
    queryKey: autoAdvanceKey(projectId),
    queryFn: () => missionControlApi.getAutoAdvanceStatus(projectId),
    refetchInterval: (query) => {
      const status = query.state.data?.session?.status;
      return status === "running" ? 3_000 : false;
    },
  });

export const useAutoAdvanceStart = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts?: StartAutoAdvanceRequest) =>
      missionControlApi.startAutoAdvance(projectId, opts),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: autoAdvanceKey(projectId) });
    },
  });
};

export const useAutoAdvanceStop = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => missionControlApi.stopAutoAdvance(projectId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: autoAdvanceKey(projectId) });
    },
  });
};

export const useAutoAdvanceResume = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => missionControlApi.resumeAutoAdvance(projectId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: autoAdvanceKey(projectId) });
    },
  });
};

export const useAutoAdvanceReset = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => missionControlApi.resetAutoAdvance(projectId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: autoAdvanceKey(projectId) });
    },
  });
};

export const useAutoAdvanceStep = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => missionControlApi.stepAutoAdvance(projectId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: autoAdvanceKey(projectId) });
    },
  });
};
