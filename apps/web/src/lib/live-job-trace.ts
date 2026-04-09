import type {
  LiveJobTraceSnapshot,
  LiveOutputLink,
  LiveToolCall,
  LiveTraceEvent,
  LiveTraceEventType,
} from "@quayboard/shared";

const jobStatuses = new Set(["queued", "running", "succeeded", "failed", "cancelled"]);

type LiveTraceEventLike = {
  createdAt: string;
  payload: Record<string, unknown>;
  sequence: number;
  type: LiveTraceEventType;
};

const toEventId = (jobId: string, sequence: number) => `${jobId}:${sequence}`;

const upsertOutputLink = (
  outputLinks: LiveOutputLink[],
  link: LiveOutputLink,
) => {
  const next = outputLinks.filter((entry) => entry.href !== link.href || entry.kind !== link.kind);
  next.push(link);
  return next;
};

const ensureToolCall = (
  toolCalls: LiveToolCall[],
  toolCallId: string,
  toolName?: string | null,
  createdAt?: string | null,
) => {
  const current = toolCalls.find((entry) => entry.id === toolCallId);
  if (current) {
    return current;
  }

  const created: LiveToolCall = {
    id: toolCallId,
    toolName: toolName ?? "Tool",
    status: "pending",
    startedAt: createdAt ?? null,
    finishedAt: null,
    durationMs: null,
    inputPreview: null,
    outputPreview: null,
    errorMessage: null,
  };

  toolCalls.push(created);
  return created;
};

export const toLiveTraceEvent = (
  jobId: string,
  projectId: string,
  event: LiveTraceEventLike,
): LiveTraceEvent => ({
  id: toEventId(jobId, event.sequence),
  jobId,
  projectId,
  sequence: event.sequence,
  type: event.type,
  payload: event.payload,
  createdAt: event.createdAt,
});

export const applyLiveTraceEvent = (
  snapshot: LiveJobTraceSnapshot,
  nextEvent: LiveTraceEvent,
): LiveJobTraceSnapshot => {
  if (nextEvent.sequence <= snapshot.latestSequence) {
    return snapshot;
  }

  const nextSnapshot: LiveJobTraceSnapshot = {
    ...snapshot,
    changedFiles: [...snapshot.changedFiles],
    events: [...snapshot.events, nextEvent],
    llmSteps: [...snapshot.llmSteps],
    outputLinks: [...snapshot.outputLinks],
    toolCalls: [...snapshot.toolCalls],
    transcript: { ...snapshot.transcript },
    latestSequence: nextEvent.sequence,
  };

  switch (nextEvent.type) {
    case "job_status":
      if (
        typeof nextEvent.payload.status === "string" &&
        jobStatuses.has(nextEvent.payload.status)
      ) {
        nextSnapshot.job = {
          ...snapshot.job,
          status: nextEvent.payload.status as LiveJobTraceSnapshot["job"]["status"],
        };
      }
      break;
    case "text_delta":
      if (typeof nextEvent.payload.text === "string") {
        nextSnapshot.transcript.output += nextEvent.payload.text;
      }
      break;
    case "reasoning_delta":
      if (typeof nextEvent.payload.text === "string") {
        nextSnapshot.transcript.reasoning += nextEvent.payload.text;
      }
      break;
    case "changed_files":
      if (Array.isArray(nextEvent.payload.files)) {
        nextSnapshot.changedFiles = nextEvent.payload.files.flatMap((file) => {
          if (!file || typeof file !== "object") {
            return [];
          }

          const candidate = file as Record<string, unknown>;
          return typeof candidate.path === "string"
            ? [
                {
                  path: candidate.path,
                  additions:
                    typeof candidate.additions === "number" ? candidate.additions : null,
                  deletions:
                    typeof candidate.deletions === "number" ? candidate.deletions : null,
                  binary: candidate.binary === true,
                },
              ]
            : [];
        });
      }
      break;
    case "tool_call_started":
      if (
        typeof nextEvent.payload.toolCallId === "string" &&
        typeof nextEvent.payload.toolName === "string"
      ) {
        const current = ensureToolCall(
          nextSnapshot.toolCalls,
          nextEvent.payload.toolCallId,
          nextEvent.payload.toolName,
          nextEvent.createdAt,
        );
        current.toolName = nextEvent.payload.toolName;
        current.status = "running";
        current.startedAt = nextEvent.createdAt;
        current.inputPreview =
          typeof nextEvent.payload.inputPreview === "string"
            ? nextEvent.payload.inputPreview
            : current.inputPreview;
      }
      break;
    case "tool_call_finished":
      if (typeof nextEvent.payload.toolCallId === "string") {
        const current = ensureToolCall(
          nextSnapshot.toolCalls,
          nextEvent.payload.toolCallId,
          typeof nextEvent.payload.toolName === "string" ? nextEvent.payload.toolName : null,
          nextEvent.createdAt,
        );
        current.status =
          nextEvent.payload.status === "failed"
            ? "failed"
            : nextEvent.payload.status === "cancelled"
              ? "cancelled"
              : "succeeded";
        current.finishedAt = nextEvent.createdAt;
        current.durationMs =
          typeof nextEvent.payload.durationMs === "number" ? nextEvent.payload.durationMs : null;
        current.outputPreview =
          typeof nextEvent.payload.outputPreview === "string"
            ? nextEvent.payload.outputPreview
            : current.outputPreview;
        current.errorMessage =
          typeof nextEvent.payload.errorMessage === "string"
            ? nextEvent.payload.errorMessage
            : current.errorMessage;
      }
      break;
    case "llm_step_started":
      if (
        typeof nextEvent.payload.key === "string" &&
        typeof nextEvent.payload.templateId === "string" &&
        typeof nextEvent.payload.provider === "string" &&
        typeof nextEvent.payload.model === "string"
      ) {
        nextSnapshot.llmSteps = [
          ...nextSnapshot.llmSteps.filter((entry) => entry.key !== nextEvent.payload.key),
          {
            key: nextEvent.payload.key,
            templateId: nextEvent.payload.templateId,
            provider: nextEvent.payload.provider,
            model: nextEvent.payload.model,
            status: "running",
            startedAt: nextEvent.createdAt,
            finishedAt: null,
            promptTokens: null,
            completionTokens: null,
            estimatedCostUsd: null,
          },
        ];
      }
      break;
    case "llm_step_finished":
      if (typeof nextEvent.payload.key === "string") {
        nextSnapshot.llmSteps = nextSnapshot.llmSteps.map((entry) =>
          entry.key === nextEvent.payload.key
            ? {
                ...entry,
                status: nextEvent.payload.status === "failed" ? "failed" : "succeeded",
                finishedAt: nextEvent.createdAt,
                promptTokens:
                  typeof nextEvent.payload.promptTokens === "number"
                    ? nextEvent.payload.promptTokens
                    : entry.promptTokens,
                completionTokens:
                  typeof nextEvent.payload.completionTokens === "number"
                    ? nextEvent.payload.completionTokens
                    : entry.completionTokens,
                estimatedCostUsd:
                  typeof nextEvent.payload.estimatedCostUsd === "number"
                    ? nextEvent.payload.estimatedCostUsd
                    : entry.estimatedCostUsd,
              }
            : entry,
        );
      }
      break;
    case "output_link":
      if (
        typeof nextEvent.payload.kind === "string" &&
        typeof nextEvent.payload.label === "string" &&
        typeof nextEvent.payload.href === "string"
      ) {
        nextSnapshot.outputLinks = upsertOutputLink(nextSnapshot.outputLinks, {
          kind: nextEvent.payload.kind as LiveOutputLink["kind"],
          label: nextEvent.payload.label,
          href: nextEvent.payload.href,
        });
      }
      break;
  }

  return nextSnapshot;
};
