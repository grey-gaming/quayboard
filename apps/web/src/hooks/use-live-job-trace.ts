import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  LiveJobTraceSnapshot,
  LiveTraceConnectionStatus,
  LiveTraceEventType,
  SseEvent,
} from "@quayboard/shared";

import { api } from "../lib/api.js";
import { applyLiveTraceEvent, toLiveTraceEvent } from "../lib/live-job-trace.js";
import { createSseConnection } from "../lib/sse.js";

const liveLagThresholdMs = 5_000;
const liveTraceEventTypes = new Set<LiveTraceEventType>([
  "changed_files",
  "error",
  "job_status",
  "llm_step_finished",
  "llm_step_started",
  "output_link",
  "reasoning_delta",
  "sandbox_event",
  "text_delta",
  "tool_call_finished",
  "tool_call_started",
]);

const parseSseEvent = (event: MessageEvent<string>): SseEvent | null => {
  try {
    return JSON.parse(event.data) as SseEvent;
  } catch {
    return null;
  }
};

export const useLiveJobTraceQuery = (projectId: string, jobId: string | null) =>
  useQuery({
    enabled: Boolean(jobId),
    queryKey: ["project", projectId, "live-job", jobId],
    queryFn: () => api.getLiveJobTrace(jobId!),
  });

export const useLiveJobDiffQuery = (
  projectId: string,
  jobId: string | null,
  filePath: string | null,
) =>
  useQuery({
    enabled: Boolean(jobId && filePath),
    queryKey: ["project", projectId, "live-job", jobId, "diff", filePath],
    queryFn: () => api.getLiveJobDiff(jobId!, filePath!),
  });

export const useLiveJobTrace = (projectId: string, jobId: string | null) => {
  const traceQuery = useLiveJobTraceQuery(projectId, jobId);
  const [snapshot, setSnapshot] = useState<LiveJobTraceSnapshot | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastSignalAt, setLastSignalAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(Date.now());

  useEffect(() => {
    if (!traceQuery.data?.snapshot) {
      setSnapshot(null);
      return;
    }

    setSnapshot(traceQuery.data.snapshot);
    setLastSignalAt(Date.now());
    setIsReconnecting(false);
  }, [traceQuery.data]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const source = createSseConnection("/api/events");
    const markSignal = () => {
      setLastSignalAt(Date.now());
      setIsReconnecting(false);
    };

    const handleTrace = (rawEvent: Event) => {
      const parsed = parseSseEvent(rawEvent as MessageEvent<string>);
      if (!parsed || parsed.type !== "job:trace" || parsed.jobId !== jobId) {
        return;
      }

      markSignal();
      setSnapshot((current) =>
        current
          ? applyLiveTraceEvent(
              current,
              toLiveTraceEvent(parsed.jobId, parsed.projectId, {
                ...parsed.event,
                type: liveTraceEventTypes.has(parsed.event.type as LiveTraceEventType)
                  ? (parsed.event.type as LiveTraceEventType)
                  : "sandbox_event",
              }),
            )
          : current,
      );
    };

    const handleHeartbeat = () => {
      markSignal();
    };

    const handleJobUpdated = (rawEvent: Event) => {
      const parsed = parseSseEvent(rawEvent as MessageEvent<string>);
      if (!parsed || parsed.type !== "job:updated" || parsed.jobId !== jobId) {
        return;
      }

      markSignal();
      void traceQuery.refetch();
    };

    source.onopen = () => {
      markSignal();
      void traceQuery.refetch();
    };
    source.onerror = () => {
      setIsReconnecting(true);
    };
    source.addEventListener("connected", handleHeartbeat);
    source.addEventListener("heartbeat", handleHeartbeat);
    source.addEventListener("job:trace", handleTrace);
    source.addEventListener("job:updated", handleJobUpdated);

    return () => {
      source.removeEventListener("connected", handleHeartbeat);
      source.removeEventListener("heartbeat", handleHeartbeat);
      source.removeEventListener("job:trace", handleTrace);
      source.removeEventListener("job:updated", handleJobUpdated);
      source.close();
    };
  }, [jobId, traceQuery.refetch]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  const connectionStatus = useMemo<LiveTraceConnectionStatus>(() => {
    if (!jobId || traceQuery.isLoading) {
      return "reconnecting";
    }

    if (isReconnecting) {
      return "reconnecting";
    }

    if (!lastSignalAt) {
      return "lagging";
    }

    return clockTick - lastSignalAt > liveLagThresholdMs ? "lagging" : "live";
  }, [clockTick, isReconnecting, jobId, lastSignalAt, traceQuery.isLoading]);

  return {
    ...traceQuery,
    connectionStatus,
    snapshot,
  };
};
