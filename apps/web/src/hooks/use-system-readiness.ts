import { useQuery } from "@tanstack/react-query";

import type { SystemReadiness } from "@quayboard/shared";

import { api } from "../lib/api.js";

export const systemReadinessQueryKey = ["system", "readiness"];

export const useSystemReadinessQuery = () =>
  useQuery({
    queryKey: systemReadinessQueryKey,
    queryFn: () => api.getSystemReadiness(),
  });

export const isSystemReadinessReady = (readiness: SystemReadiness | undefined) => {
  if (!readiness || readiness.checks.length === 0) {
    return false;
  }

  return readiness.checks.every((check) => check.status === "pass");
};
