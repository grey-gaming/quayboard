import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createSseConnection } from "../lib/sse.js";

type JobUpdatedEventPayload = {
  jobId?: string;
  projectId?: string | null;
  status?: string;
};

type ProjectUpdatedEventPayload = {
  projectId?: string;
  resource?: "feature" | "milestone" | "phase_gates" | "project_review";
};

type SandboxUpdatedEventPayload = {
  projectId?: string;
  sandboxRunId?: string;
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

const isProjectUpdatedEventPayload = (value: unknown): value is ProjectUpdatedEventPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    ("projectId" in candidate ? typeof candidate.projectId === "string" : true) &&
    ("resource" in candidate
      ? candidate.resource === "feature" ||
        candidate.resource === "milestone" ||
        candidate.resource === "phase_gates" ||
        candidate.resource === "project_review"
      : true)
  );
};

const isSandboxUpdatedEventPayload = (value: unknown): value is SandboxUpdatedEventPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    ("projectId" in candidate ? typeof candidate.projectId === "string" : true) &&
    ("sandboxRunId" in candidate ? typeof candidate.sandboxRunId === "string" : true)
  );
};

export const useSseEvents = (projectId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = createSseConnection("/api/events");
    const refetchActiveProjectQueries = async (activeProjectId: string) => {
      const projectKeys = [
        ["project", activeProjectId],
        ["project", activeProjectId, "jobs"],
        ["project", activeProjectId, "questionnaire"],
        ["project", activeProjectId, "one-pager"],
        ["project", activeProjectId, "one-pager-versions"],
        ["project", activeProjectId, "product-spec"],
        ["project", activeProjectId, "product-spec-versions"],
        ["project", activeProjectId, "user-flows"],
        ["project", activeProjectId, "ux-decision-tiles"],
        ["project", activeProjectId, "tech-decision-tiles"],
        ["project", activeProjectId, "ux-spec"],
        ["project", activeProjectId, "ux-spec-versions"],
        ["project", activeProjectId, "tech-spec"],
        ["project", activeProjectId, "tech-spec-versions"],
        ["project", activeProjectId, "phase-gates"],
        ["project", activeProjectId, "next-actions"],
        ["project", activeProjectId, "auto-advance"],
        ["project", activeProjectId, "milestones"],
        ["project", activeProjectId, "features"],
        ["project", activeProjectId, "features-graph"],
        ["project", activeProjectId, "features-rollup"],
        ["project", activeProjectId, "project-reviews"],
        ["project", activeProjectId, "project-review-latest"],
      ] as const;

      await Promise.all(
        projectKeys.map((key) =>
          queryClient.refetchQueries({
            exact: true,
            queryKey: key,
            type: "active",
          }),
        ),
      );
      await Promise.all([
        queryClient.refetchQueries({
          predicate: (query) => {
            const [scope, , resource] = query.queryKey;
            return (
              (scope === "milestone" && resource === "design-docs") ||
              (scope === "feature" &&
                typeof resource === "string" &&
                (resource === "tracks" || resource.endsWith("-revisions")))
            );
          },
          type: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "artifact-approval"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "sandbox-options"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "sandbox-runs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "sandbox-containers"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "context-packs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project", activeProjectId, "memory-chunks"],
        }),
        queryClient.invalidateQueries({
          predicate: (query) => {
            const [scope, keyProjectId, resource] = query.queryKey;
            return (
              scope === "milestone" &&
              typeof keyProjectId === "string" &&
              resource === "sandbox-sessions"
            );
          },
        }),
      ]);
    };

    const handleProjectEvent = (event: Event) => {
      let eventProjectId: string | null | undefined;

      if ("data" in event && typeof event.data === "string" && event.data) {
        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (isJobUpdatedEventPayload(parsed)) {
            eventProjectId = parsed.projectId;
          } else if (isProjectUpdatedEventPayload(parsed)) {
            eventProjectId = parsed.projectId;
          } else if (isSandboxUpdatedEventPayload(parsed)) {
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

    source.addEventListener("job:updated", handleProjectEvent);
    source.addEventListener("project:updated", handleProjectEvent);
    source.addEventListener("auto-advance:updated", handleProjectEvent);
    source.addEventListener("sandbox:updated", handleProjectEvent);

    return () => {
      source.removeEventListener("job:updated", handleProjectEvent);
      source.removeEventListener("project:updated", handleProjectEvent);
      source.removeEventListener("auto-advance:updated", handleProjectEvent);
      source.removeEventListener("sandbox:updated", handleProjectEvent);
      source.close();
    };
  }, [projectId, queryClient]);
};
