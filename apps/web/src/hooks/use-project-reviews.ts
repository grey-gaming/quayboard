import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api.js";

export const useProjectReviewsQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "project-reviews"],
    queryFn: () => api.listProjectReviews(projectId),
  });

export const useLatestProjectReviewQuery = (projectId: string) =>
  useQuery({
    enabled: Boolean(projectId),
    queryKey: ["project", projectId, "project-review-latest"],
    queryFn: () => api.getLatestProjectReview(projectId),
  });

export const useFinalizeMilestonePlanMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.finalizeMilestonePlan(projectId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "project-review-latest"] }),
      ]);
    },
  });
};

export const useReopenMilestonePlanMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.reopenMilestonePlan(projectId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "project-review-latest"] }),
      ]);
    },
  });
};

export const useStartProjectReviewMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.startProjectReview(projectId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "project-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "project-review-latest"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "sandbox-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "phase-gates"] }),
      ]);
    },
  });
};

export const useRetryProjectReviewFixesMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => api.retryProjectReviewFixes(reviewId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "project-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "project-review-latest"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "sandbox-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId, "next-actions"] }),
      ]);
    },
  });
};
