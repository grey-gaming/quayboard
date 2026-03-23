import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type RefreshJob = {
  completedAt?: string | null;
  id: string;
  status?: string | null;
};

type UseJobDrivenRefreshOptions = {
  active: boolean;
  intervalMs?: number;
  latestJob?: RefreshJob | null;
  queryKeys: QueryKey[];
};

export const useJobDrivenRefresh = ({
  active,
  intervalMs = 1_000,
  latestJob,
  queryKeys,
}: UseJobDrivenRefreshOptions) => {
  const queryClient = useQueryClient();
  const lastCompletedJobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const refreshQueries = () =>
      Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

    const refreshHandle = window.setInterval(() => {
      void refreshQueries();
    }, intervalMs);

    return () => {
      window.clearInterval(refreshHandle);
    };
  }, [active, intervalMs, queryClient, queryKeys]);

  useEffect(() => {
    if (
      latestJob?.status !== "succeeded" ||
      !latestJob.completedAt ||
      lastCompletedJobRef.current === latestJob.id
    ) {
      return;
    }

    lastCompletedJobRef.current = latestJob.id;
    void Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  }, [latestJob?.completedAt, latestJob?.id, latestJob?.status, queryClient, queryKeys]);
};
