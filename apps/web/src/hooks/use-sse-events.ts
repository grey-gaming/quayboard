import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createSseConnection } from "../lib/sse.js";

type JobUpdatedEventPayload = {
  jobId?: string;
  projectId?: string | null;
  status?: string;
};

const isJobUpdatedEventPayload = (value: unknown): value is JobUpdatedEventPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    ("jobId" in candidate ? typeof candidate.jobId === "string" : true) &&
    ("projectId" in candidate
      ? candidate.projectId === null || typeof candidate.projectId === "string"
      : true) &&
    ("status" in candidate ? typeof candidate.status === "string" : true)
  );
};

export const useSseEvents = (projectId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = createSseConnection("/api/events");
    const refetchActiveProjectQueries = async (activeProjectId: string) => {
      const keys = [
        ["project", activeProjectId],
        ["project", activeProjectId, "jobs"],
        ["project", activeProjectId, "questionnaire"],
        ["project", activeProjectId, "one-pager"],
        ["project", activeProjectId, "one-pager-versions"],
        ["project", activeProjectId, "product-spec"],
        ["project", activeProjectId, "product-spec-versions"],
        ["project", activeProjectId, "user-flows"],
        ["project", activeProjectId, "decision-cards"],
        ["project", activeProjectId, "blueprints"],
        ["project", activeProjectId, "phase-gates"],
        ["project", activeProjectId, "next-actions"],
      ] as const;

      await Promise.all(
        keys.map((key) =>
          queryClient.refetchQueries({
            exact: true,
            queryKey: key,
            type: "active",
          }),
        ),
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "artifact-state"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "artifact-review-items"],
        }),
      ]);
    };

    const handleJobUpdated = (event: Event) => {
      let eventProjectId: string | null | undefined;

      if ("data" in event && typeof event.data === "string" && event.data) {
        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (isJobUpdatedEventPayload(parsed)) {
            eventProjectId = parsed.projectId;
          }
        } catch {
          eventProjectId = undefined;
        }
      }

      if (projectId) {
        if (eventProjectId && eventProjectId !== projectId) {
          return;
        }

        void refetchActiveProjectQueries(projectId);
        return;
      }

      void queryClient.refetchQueries({
        exact: true,
        queryKey: ["projects"],
        type: "active",
      });
    };

    source.addEventListener("job:updated", handleJobUpdated);

    return () => {
      source.removeEventListener("job:updated", handleJobUpdated);
      source.close();
    };
  }, [projectId, queryClient]);
};
