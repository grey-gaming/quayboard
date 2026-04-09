import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { Job, LiveToolCall } from "@quayboard/shared";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildMissionControlTertiaryItems } from "../components/layout/project-navigation.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { useLiveJobDiffQuery, useLiveJobTrace } from "../hooks/use-live-job-trace.js";
import { useProjectJobsQuery, useProjectQuery } from "../hooks/use-projects.js";
import { formatDateTime, formatJobType } from "../lib/format.js";

const activeStatuses = new Set(["queued", "running"]);
const recentJobLimit = 10;

const connectionTone = (
  status: "live" | "lagging" | "reconnecting",
): "success" | "warning" | "danger" => {
  switch (status) {
    case "live":
      return "success";
    case "lagging":
      return "warning";
    default:
      return "danger";
  }
};

const formatCount = (value: number | null) => (value === null ? "binary" : `${value}`);

const formatCost = (value: number | null) => (value === null ? null : `$${value.toFixed(4)}`);

type TodoItemStatus = "pending" | "in_progress" | "completed";

type TodoItem = {
  content: string;
  status: TodoItemStatus;
};

const isTodoWriteToolCall = (toolName: string) => toolName.trim().toLowerCase() === "todowrite";

const normalizeTodoStatus = (status: unknown): TodoItemStatus => {
  if (typeof status !== "string") {
    return "pending";
  }

  const normalized = status.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["completed", "complete", "done", "succeeded", "success"].includes(normalized)) {
    return "completed";
  }

  if (["in_progress", "inprogress", "running", "active"].includes(normalized)) {
    return "in_progress";
  }

  return "pending";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseTodoPayload = (payload: unknown): TodoItem[] => {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.todos)
      ? payload.todos
      : [];

  return items.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const content =
      typeof item.content === "string"
        ? item.content
        : typeof item.text === "string"
          ? item.text
          : null;
    const trimmedContent = content?.trim();

    if (!trimmedContent) {
      return [];
    }

    return [
      {
        content: trimmedContent,
        status: normalizeTodoStatus(item.status),
      },
    ];
  });
};

const parseTodoPreview = (preview: string | null): TodoItem[] => {
  if (!preview) {
    return [];
  }

  try {
    return parseTodoPayload(JSON.parse(preview) as unknown);
  } catch {
    return [];
  }
};

const buildToolCallSections = (toolCalls: LiveToolCall[]) => {
  const todoToolCalls = toolCalls.filter((toolCall) => isTodoWriteToolCall(toolCall.toolName));
  const nonTodoToolCalls = toolCalls.filter((toolCall) => !isTodoWriteToolCall(toolCall.toolName));

  for (let index = todoToolCalls.length - 1; index >= 0; index -= 1) {
    const toolCall = todoToolCalls[index];
    const fromOutput = parseTodoPreview(toolCall.outputPreview);
    if (fromOutput.length) {
      return { nonTodoToolCalls, todoItems: fromOutput };
    }

    const fromInput = parseTodoPreview(toolCall.inputPreview);
    if (fromInput.length) {
      return { nonTodoToolCalls, todoItems: fromInput };
    }
  }

  return { nonTodoToolCalls, todoItems: [] as TodoItem[] };
};

const todoStatusLabel = (status: TodoItemStatus) =>
  status === "completed" ? "completed" : status === "in_progress" ? "in progress" : "not started";

const TodoStatusIcon = ({ status }: { status: TodoItemStatus }) => {
  if (status === "completed") {
    return (
      <svg aria-hidden="true" className="h-4 w-4 text-success" fill="none" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 8.1 7.1 10.2 11.2 6.1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (status === "in_progress") {
    return (
      <svg aria-hidden="true" className="h-4 w-4 text-info" fill="none" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.2 8h5.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4 text-secondary" fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
};

const buildJobGroups = (jobs: Job[]) => {
  const active = jobs.filter((job) => activeStatuses.has(job.status));
  const recent = jobs
    .filter((job) => !activeStatuses.has(job.status))
    .slice(0, recentJobLimit);

  return { active, recent };
};

export const MissionControlLivePage = () => {
  const { id = "", jobId } = useParams();
  const [followLive, setFollowLive] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const reasoningRef = useRef<HTMLDivElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const projectQuery = useProjectQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const jobs = jobsQuery.data?.jobs ?? [];
  const { active, recent } = useMemo(() => buildJobGroups(jobs), [jobs]);
  const selectedJobId = jobId ?? active[0]?.id ?? recent[0]?.id ?? null;
  const liveTrace = useLiveJobTrace(id, selectedJobId);
  const snapshot = liveTrace.snapshot;
  const diffQuery = useLiveJobDiffQuery(id, selectedJobId, selectedFilePath);
  const { nonTodoToolCalls, todoItems } = useMemo(
    () => buildToolCallSections(snapshot?.toolCalls ?? []),
    [snapshot?.toolCalls],
  );

  useEffect(() => {
    setFollowLive(true);
  }, [selectedJobId]);

  useEffect(() => {
    const nextFile = snapshot?.changedFiles[0]?.path ?? null;
    setSelectedFilePath((current) =>
      current && snapshot?.changedFiles.some((entry) => entry.path === current) ? current : nextFile,
    );
  }, [snapshot?.changedFiles]);

  useEffect(() => {
    if (!followLive) {
      return;
    }

    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [followLive, snapshot?.events.length, snapshot?.transcript.output, snapshot?.transcript.reasoning]);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  const tertiaryItems = buildMissionControlTertiaryItems(projectQuery.data, jobs, selectedJobId);

  return (
    <ProjectPageFrame
      activeSection="mission-control"
      project={projectQuery.data}
      tertiaryItems={tertiaryItems}
    >
      <PageIntro
        eyebrow="Project"
        title="Live Mission Control"
        summary="Observe active and recent jobs as they stream model output, tool activity, and repository changes."
        meta={
          <>
            <Badge tone={connectionTone(liveTrace.connectionStatus)}>
              {liveTrace.connectionStatus}
            </Badge>
            <Badge tone="neutral">{active.length} active jobs</Badge>
            <Badge tone="neutral">{recent.length} recent jobs</Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Transcript</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  {snapshot ? formatJobType(snapshot.job.type) : "Select a job"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={[
                    "rounded-sm border px-3 py-1 text-sm transition-colors",
                    followLive
                      ? "border-border-strong bg-panel-raised"
                      : "border-border/80 bg-panel-inset hover:bg-panel",
                  ].join(" ")}
                  onClick={() => setFollowLive((current) => !current)}
                  type="button"
                >
                  {followLive ? "Following live" : "Resume live"}
                </button>
                {snapshot?.relatedSandboxRun ? (
                  <Link
                    className="rounded-sm border border-border/80 bg-panel-inset px-3 py-1 text-sm hover:bg-panel"
                    to={`/projects/${id}/develop`}
                  >
                    Open run
                  </Link>
                ) : null}
              </div>
            </div>

            {snapshot ? (
              <div className="mt-4 grid gap-4">
                {snapshot.llmSteps.length ? (
                  <div className="flex flex-wrap gap-2">
                    {snapshot.llmSteps.map((step) => (
                      <Badge key={step.key} tone={step.status === "failed" ? "danger" : "neutral"}>
                        {step.templateId} · {step.model}
                        {step.promptTokens !== null || step.completionTokens !== null
                          ? ` · ${step.promptTokens ?? 0}/${step.completionTokens ?? 0} tok`
                          : ""}
                        {formatCost(step.estimatedCostUsd) ? ` · ${formatCost(step.estimatedCostUsd)}` : ""}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {snapshot.outputLinks.length ? (
                  <div className="flex flex-wrap gap-2">
                    {snapshot.outputLinks.map((link) => (
                      <Link
                        key={`${link.kind}:${link.href}`}
                        className="rounded-sm border border-border/80 bg-panel-inset px-3 py-1 text-sm hover:bg-panel"
                        to={link.href}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4" data-testid="live-transcript-stack">
                  <div className="border border-border/80 bg-panel-inset p-4">
                    <p className="qb-meta-label">Thinking</p>
                    <div
                      ref={reasoningRef}
                      className="mt-2 max-h-[20rem] overflow-auto border-l-2 border-info/50 pl-4"
                      onScroll={(event) => {
                        const target = event.currentTarget;
                        const bottomGap =
                          target.scrollHeight - target.scrollTop - target.clientHeight;
                        if (bottomGap > 64 && followLive) {
                          setFollowLive(false);
                        }
                      }}
                    >
                      <pre className="whitespace-pre-wrap font-sans text-sm text-secondary">
                        {snapshot.transcript.reasoning || "Waiting for streamed thinking."}
                      </pre>
                    </div>
                  </div>
                  <div className="border border-border/80 bg-panel-inset p-4">
                    <p className="qb-meta-label">Output</p>
                    <div
                      ref={outputRef}
                      className="mt-2 max-h-[28rem] overflow-auto"
                      onScroll={(event) => {
                        const target = event.currentTarget;
                        const bottomGap =
                          target.scrollHeight - target.scrollTop - target.clientHeight;
                        if (bottomGap > 64 && followLive) {
                          setFollowLive(false);
                        }
                      }}
                    >
                      <pre className="whitespace-pre-wrap font-sans text-sm text-primary">
                        {snapshot.transcript.output || "Waiting for streamed output."}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-secondary">
                {selectedJobId ? "Loading live trace..." : "No jobs available to observe yet."}
              </p>
            )}
          </Card>

          <Card surface="rail" data-testid="tools-calls-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Tools</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Calls</p>
              </div>
              <Badge data-testid="tools-call-count" tone="neutral">
                {nonTodoToolCalls.length}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3">
              {nonTodoToolCalls.length ? nonTodoToolCalls.map((toolCall) => (
                <div key={toolCall.id} className="border border-border/80 bg-panel-inset p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{toolCall.toolName}</p>
                    <Badge
                      tone={
                        toolCall.status === "failed"
                          ? "danger"
                          : toolCall.status === "running"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {toolCall.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    {toolCall.startedAt ? formatDateTime(toolCall.startedAt) : "Pending"}
                    {toolCall.durationMs !== null ? ` · ${toolCall.durationMs} ms` : ""}
                  </p>
                  {toolCall.inputPreview ? (
                    <pre className="mt-3 whitespace-pre-wrap border border-border/70 bg-panel px-3 py-2 font-sans text-xs text-secondary">
                      {toolCall.inputPreview}
                    </pre>
                  ) : null}
                  {toolCall.outputPreview ? (
                    <div
                      className="mt-3 overflow-hidden rounded-sm border border-border/70 bg-panel px-3 py-2"
                      data-testid={`tool-output-preview-${toolCall.id}`}
                    >
                      <pre className="max-h-[7rem] overflow-hidden whitespace-pre-wrap font-sans text-xs text-secondary">
                        {toolCall.outputPreview}
                      </pre>
                    </div>
                  ) : null}
                  {toolCall.errorMessage ? (
                    <p className="mt-2 text-xs text-danger">{toolCall.errorMessage}</p>
                  ) : null}
                </div>
              )) : (
                <p className="text-sm text-secondary">No tool calls recorded for this job.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4" data-testid="live-right-rail">
          {todoItems.length ? (
            <Card surface="rail" className="h-fit" data-testid="live-todo-card">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">Mission</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">TODO List</p>
                </div>
                <Badge tone="neutral">{todoItems.length}</Badge>
              </div>
              <div className="mt-4 grid gap-2">
                {todoItems.map((todoItem, index) => (
                  <div
                    key={`${todoItem.content}:${index}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border border-border/80 bg-panel-inset px-3 py-2"
                    data-status={todoItem.status}
                    data-testid={`live-todo-item-${index}`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center" title={todoStatusLabel(todoItem.status)}>
                      <TodoStatusIcon status={todoItem.status} />
                      <span className="sr-only">{todoStatusLabel(todoItem.status)}</span>
                    </span>
                    <p className="text-sm text-primary">{todoItem.content}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card surface="rail" className="h-fit" data-testid="live-feed-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Jobs</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Live Feed</p>
              </div>
              <Badge tone="neutral">{jobs.length}</Badge>
            </div>

            <div className="mt-4 grid gap-4">
              <section className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="qb-meta-label">Active</p>
                  <span className="text-xs text-secondary">{active.length}</span>
                </div>
                <div className="grid gap-2">
                  {active.length ? active.map((job) => (
                    <Link
                      key={job.id}
                      className={[
                        "rounded-sm border px-3 py-2 text-sm transition-colors",
                        selectedJobId === job.id
                          ? "border-border-strong bg-panel-raised"
                          : "border-border/80 bg-panel-inset hover:bg-panel",
                      ].join(" ")}
                      to={`/projects/${id}/live/${job.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={formatJobType(job.type)}
                        >
                          {formatJobType(job.type)}
                        </span>
                        <Badge tone={job.status === "running" ? "info" : "neutral"}>{job.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-secondary">{formatDateTime(job.startedAt ?? job.queuedAt)}</p>
                    </Link>
                  )) : (
                    <p className="text-sm text-secondary">No active jobs.</p>
                  )}
                </div>
              </section>

              <section className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="qb-meta-label">Recent</p>
                  <span className="text-xs text-secondary">{recent.length}</span>
                </div>
                <div className="grid gap-2">
                  {recent.length ? recent.map((job) => (
                    <Link
                      key={job.id}
                      className={[
                        "rounded-sm border px-3 py-2 text-sm transition-colors",
                        selectedJobId === job.id
                          ? "border-border-strong bg-panel-raised"
                          : "border-border/80 bg-panel-inset hover:bg-panel",
                      ].join(" ")}
                      to={`/projects/${id}/live/${job.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={formatJobType(job.type)}
                        >
                          {formatJobType(job.type)}
                        </span>
                        <Badge tone="neutral">{job.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-secondary">
                        {formatDateTime(job.completedAt ?? job.startedAt ?? job.queuedAt)}
                      </p>
                    </Link>
                  )) : (
                    <p className="text-sm text-secondary">No completed traceable jobs yet.</p>
                  )}
                </div>
              </section>
            </div>
          </Card>

          <Card surface="rail" className="h-fit" data-testid="changed-files-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Repository</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Changed Files</p>
              </div>
              <Badge tone="neutral">{snapshot?.changedFiles.length ?? 0}</Badge>
            </div>
            <div className="mt-4 grid gap-2">
              {snapshot?.changedFiles.length ? snapshot.changedFiles.map((file) => (
                <button
                  key={file.path}
                  className={[
                    "grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 border px-3 py-2 text-left text-sm transition-colors",
                    selectedFilePath === file.path
                      ? "border-border-strong bg-panel-raised"
                      : "border-border/80 bg-panel-inset hover:bg-panel",
                  ].join(" ")}
                  onClick={() => setSelectedFilePath(file.path)}
                  type="button"
                >
                  <span className="text-success">+{formatCount(file.additions)}</span>
                  <span className="text-danger">-{formatCount(file.deletions)}</span>
                  <span className="truncate font-medium" title={file.path}>
                    {file.path}
                  </span>
                </button>
              )) : (
                <p className="text-sm text-secondary">No repository file changes for this job.</p>
              )}
            </div>
          </Card>

          <Card surface="panel" className="min-h-[20rem]" data-testid="patch-preview-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Patch Preview</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  {selectedFilePath ?? "Select a file"}
                </p>
              </div>
              {diffQuery.isFetching ? <Badge tone="neutral">refreshing</Badge> : null}
            </div>
            <div className="mt-4">
              {selectedFilePath ? (
                <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap border border-border/80 bg-panel-inset p-4 font-mono text-xs text-primary">
                  {diffQuery.data?.patch || "Patch preview not available yet."}
                </pre>
              ) : (
                <p className="text-sm text-secondary">Select a changed file to inspect its patch.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </ProjectPageFrame>
  );
};
