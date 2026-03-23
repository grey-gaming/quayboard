import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api.js";

const taskPlanningKey = (featureId: string) => ["task-planning", featureId];
const clarificationsKey = (featureId: string) => ["clarifications", featureId];
const tasksKey = (featureId: string) => ["tasks", featureId];
const implementationRecordsKey = (featureId: string) => [
  "implementation-records",
  featureId,
];

export const useTaskPlanningSessionQuery = (featureId: string) =>
  useQuery({
    queryKey: taskPlanningKey(featureId),
    queryFn: () => api.getTaskPlanningSession(featureId),
  });

export const useClarificationsQuery = (featureId: string) =>
  useQuery({
    queryKey: clarificationsKey(featureId),
    queryFn: () => api.getClarifications(featureId),
  });

export const useTasksQuery = (featureId: string) =>
  useQuery({
    queryKey: tasksKey(featureId),
    queryFn: () => api.getTasks(featureId),
  });

export const useImplementationRecordsQuery = (featureId: string) =>
  useQuery({
    queryKey: implementationRecordsKey(featureId),
    queryFn: () => api.getImplementationRecords(featureId),
  });

export const useGenerateClarificationsMutation = (featureId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateClarifications(featureId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clarificationsKey(featureId) });
    },
  });
};

export const useAnswerClarificationMutation = (featureId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clarificationId,
      answer,
    }: {
      clarificationId: string;
      answer: string;
    }) => api.answerClarification(featureId, clarificationId, answer),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clarificationsKey(featureId) });
      void queryClient.invalidateQueries({ queryKey: taskPlanningKey(featureId) });
    },
  });
};

export const useAutoAnswerClarificationsMutation = (featureId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.autoAnswerClarifications(featureId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clarificationsKey(featureId) });
      void queryClient.invalidateQueries({ queryKey: taskPlanningKey(featureId) });
    },
  });
};

export const useGenerateTasksMutation = (featureId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generateTasks(featureId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksKey(featureId) });
      void queryClient.invalidateQueries({ queryKey: taskPlanningKey(featureId) });
    },
  });
};

export const useCreateImplementationRecordMutation = (featureId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      techRevisionId: string;
      commitSha?: string;
      sandboxRunId?: string;
    }) => api.createImplementationRecord(featureId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: implementationRecordsKey(featureId),
      });
    },
  });
};