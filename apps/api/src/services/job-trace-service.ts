import { and, asc, desc, eq, sql } from "drizzle-orm";

import {
  liveChangedFileSchema,
  liveJobDiffResponseSchema,
  liveJobTraceResponseSchema,
  type LiveChangedFile,
  type LiveLlmStepSummary,
  type LiveOutputLink,
  type LiveToolCall,
  type LiveTraceEventType,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  jobTraceEventsTable,
  jobsTable,
  projectsTable,
  sandboxRunArtifactsTable,
  sandboxRunsTable,
} from "../db/schema.js";
import { HttpError } from "./http-error.js";
import { generateId } from "./ids.js";
import type { ArtifactStorageService } from "./artifact-storage-service.js";
import type { SandboxService } from "./sandbox-service.js";
import type { SseHub } from "./sse.js";

type JobTraceEventInput = {
  jobId: string;
  projectId: string;
  payload?: Record<string, unknown>;
  type: LiveTraceEventType;
};

const toEvent = (record: typeof jobTraceEventsTable.$inferSelect) => ({
  id: record.id,
  jobId: record.jobId,
  projectId: record.projectId,
  sequence: record.sequence,
  type: record.type as LiveTraceEventType,
  payload:
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {},
  createdAt: record.createdAt.toISOString(),
});

const parseChangedFiles = (payload: unknown): LiveChangedFile[] => {
  if (!payload || typeof payload !== "object" || !("files" in payload)) {
    return [];
  }

  const { files } = payload as { files?: unknown };
  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file) => {
    const parsed = liveChangedFileSchema.safeParse(file);
    return parsed.success ? [parsed.data] : [];
  });
};

const buildOutputLinks = (
  job: typeof jobsTable.$inferSelect,
  events: ReturnType<typeof toEvent>[],
): LiveOutputLink[] => {
  const links = new Map<string, LiveOutputLink>();
  const outputs =
    job.outputs && typeof job.outputs === "object" ? (job.outputs as Record<string, unknown>) : {};

  const projectId = job.projectId ?? null;
  if (!projectId) {
    return [];
  }

  const add = (key: string, link: LiveOutputLink | null) => {
    if (link) {
      links.set(key, link);
    }
  };

  add(
    "one-pager",
    typeof outputs.onePagerId === "string"
      ? {
          kind: "one_pager",
          label: "Overview",
          href: `/projects/${projectId}/one-pager`,
        }
      : null,
  );
  add(
    "product-spec",
    typeof outputs.productSpecId === "string"
      ? {
          kind: "product_spec",
          label: "Product Spec",
          href: `/projects/${projectId}/product-spec`,
        }
      : null,
  );
  add(
    "milestone-design-doc",
    typeof outputs.designDocId === "string"
      ? {
          kind: "milestone_design_doc",
          label: "Milestones",
          href: `/projects/${projectId}/milestones`,
        }
      : null,
  );
  add(
    "sandbox-run",
    typeof outputs.sandboxRunId === "string"
      ? {
          kind: "sandbox_run",
          label: "Develop",
          href: `/projects/${projectId}/develop`,
        }
      : null,
  );
  add(
    "bug-report",
    typeof outputs.bugId === "string"
      ? {
          kind: "bug_report",
          label: "Bugs",
          href: `/projects/${projectId}/develop/bugs`,
        }
      : null,
  );
  add(
    "task-session",
    typeof outputs.featureId === "string" && typeof outputs.sessionId === "string"
      ? {
          kind: "task_session",
          label: "Feature Tasks",
          href: `/projects/${projectId}/features/${outputs.featureId}/tasks`,
        }
      : null,
  );

  for (const event of events) {
    if (event.type !== "output_link") {
      continue;
    }

    const payload = event.payload;
    if (
      typeof payload.key === "string" &&
      typeof payload.kind === "string" &&
      typeof payload.label === "string" &&
      typeof payload.href === "string"
    ) {
      links.set(payload.key, {
        kind: payload.kind as LiveOutputLink["kind"],
        label: payload.label,
        href: payload.href,
      });
    }
  }

  return Array.from(links.values());
};

export const createJobTraceService = (input: {
  artifactStorageService: ArtifactStorageService;
  db: AppDatabase;
  sandboxService: SandboxService;
  sseHub: SseHub;
}) => ({
  async appendEvent(event: JobTraceEventInput) {
    return input.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('job_trace_events'), hashtext(${event.jobId}))`,
      );

      const latest = await tx.query.jobTraceEventsTable.findFirst({
        where: eq(jobTraceEventsTable.jobId, event.jobId),
        orderBy: [desc(jobTraceEventsTable.sequence)],
      });

      const [created] = await tx
        .insert(jobTraceEventsTable)
        .values({
          id: generateId(),
          jobId: event.jobId,
          projectId: event.projectId,
          sequence: (latest?.sequence ?? -1) + 1,
          type: event.type,
          payload: event.payload ?? {},
          createdAt: new Date(),
        })
        .returning();

      const eventRecord = toEvent(created);
      const project = await tx.query.projectsTable.findFirst({
        where: eq(projectsTable.id, event.projectId),
      });

      if (project) {
        input.sseHub.publish(project.ownerUserId, "job:trace", {
          type: "job:trace",
          jobId: eventRecord.jobId,
          projectId: eventRecord.projectId,
          event: {
            sequence: eventRecord.sequence,
            type: eventRecord.type,
            createdAt: eventRecord.createdAt,
            payload: eventRecord.payload,
          },
        });
      }

      return eventRecord;
    });
  },

  async getOwnedSnapshot(ownerUserId: string, jobId: string) {
    const [jobResult] = await input.db
      .select({
        job: jobsTable,
        ownerUserId: projectsTable.ownerUserId,
      })
      .from(jobsTable)
      .innerJoin(projectsTable, eq(projectsTable.id, jobsTable.projectId))
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!jobResult || jobResult.ownerUserId !== ownerUserId) {
      throw new HttpError(404, "job_not_found", "Job not found.");
    }

    const [events, relatedRunRecord] = await Promise.all([
      input.db.query.jobTraceEventsTable.findMany({
        where: eq(jobTraceEventsTable.jobId, jobId),
        orderBy: [asc(jobTraceEventsTable.sequence)],
      }),
      input.db.query.sandboxRunsTable.findFirst({
        where: eq(sandboxRunsTable.triggeredByJobId, jobId),
        orderBy: [desc(sandboxRunsTable.createdAt)],
      }),
    ]);

    const normalizedEvents = events.map(toEvent);
    let output = "";
    let reasoning = "";
    let changedFiles: LiveChangedFile[] = [];
    const toolCalls = new Map<string, LiveToolCall>();
    const llmSteps = new Map<string, LiveLlmStepSummary>();

    for (const event of normalizedEvents) {
      switch (event.type) {
        case "text_delta":
          if (typeof event.payload.text === "string") {
            output += event.payload.text;
          }
          break;
        case "reasoning_delta":
          if (typeof event.payload.text === "string") {
            reasoning += event.payload.text;
          }
          break;
        case "changed_files":
          changedFiles = parseChangedFiles(event.payload);
          break;
        case "tool_call_started":
          if (typeof event.payload.toolCallId === "string" && typeof event.payload.toolName === "string") {
            toolCalls.set(event.payload.toolCallId, {
              id: event.payload.toolCallId,
              toolName: event.payload.toolName,
              status: "running",
              startedAt: event.createdAt,
              finishedAt: null,
              durationMs: null,
              inputPreview:
                typeof event.payload.inputPreview === "string" ? event.payload.inputPreview : null,
              outputPreview: null,
              errorMessage: null,
            });
          }
          break;
        case "tool_call_finished":
          if (typeof event.payload.toolCallId === "string") {
            const current = toolCalls.get(event.payload.toolCallId);
            if (current) {
              toolCalls.set(event.payload.toolCallId, {
                ...current,
                status:
                  event.payload.status === "failed"
                    ? "failed"
                    : event.payload.status === "cancelled"
                      ? "cancelled"
                      : "succeeded",
                finishedAt: event.createdAt,
                durationMs:
                  typeof event.payload.durationMs === "number" ? event.payload.durationMs : null,
                outputPreview:
                  typeof event.payload.outputPreview === "string" ? event.payload.outputPreview : null,
                errorMessage:
                  typeof event.payload.errorMessage === "string" ? event.payload.errorMessage : null,
              });
            }
          }
          break;
        case "llm_step_started":
          if (
            typeof event.payload.key === "string" &&
            typeof event.payload.templateId === "string" &&
            typeof event.payload.provider === "string" &&
            typeof event.payload.model === "string"
          ) {
            llmSteps.set(event.payload.key, {
              key: event.payload.key,
              templateId: event.payload.templateId,
              provider: event.payload.provider,
              model: event.payload.model,
              status: "running",
              startedAt: event.createdAt,
              finishedAt: null,
              promptTokens: null,
              completionTokens: null,
              estimatedCostUsd: null,
            });
          }
          break;
        case "llm_step_finished":
          if (typeof event.payload.key === "string") {
            const current = llmSteps.get(event.payload.key);
            if (current) {
              llmSteps.set(event.payload.key, {
                ...current,
                status: event.payload.status === "failed" ? "failed" : "succeeded",
                finishedAt: event.createdAt,
                promptTokens:
                  typeof event.payload.promptTokens === "number" ? event.payload.promptTokens : null,
                completionTokens:
                  typeof event.payload.completionTokens === "number"
                    ? event.payload.completionTokens
                    : null,
                estimatedCostUsd:
                  typeof event.payload.estimatedCostUsd === "number"
                    ? event.payload.estimatedCostUsd
                    : null,
              });
            }
          }
          break;
      }
    }

    const relatedSandboxRun = relatedRunRecord
      ? (await input.sandboxService.getRun(ownerUserId, relatedRunRecord.id)).run
      : null;

    return liveJobTraceResponseSchema.parse({
      snapshot: {
        job: {
          id: jobResult.job.id,
          projectId: jobResult.job.projectId,
          type: jobResult.job.type,
          status: jobResult.job.status,
          inputs: jobResult.job.inputs,
          outputs: jobResult.job.outputs ?? null,
          error: jobResult.job.error ?? null,
          queuedAt: jobResult.job.queuedAt.toISOString(),
          startedAt: jobResult.job.startedAt?.toISOString() ?? null,
          completedAt: jobResult.job.completedAt?.toISOString() ?? null,
        },
        events: normalizedEvents,
        changedFiles,
        toolCalls: Array.from(toolCalls.values()),
        llmSteps: Array.from(llmSteps.values()),
        outputLinks: buildOutputLinks(jobResult.job, normalizedEvents),
        transcript: { output, reasoning },
        relatedSandboxRun,
        latestSequence: normalizedEvents.at(-1)?.sequence ?? 0,
      },
    });
  },

  async getOwnedDiff(ownerUserId: string, jobId: string, filePath: string) {
    const snapshot = await this.getOwnedSnapshot(ownerUserId, jobId);
    const runId = snapshot.snapshot.relatedSandboxRun?.id ?? null;

    if (!runId) {
      return liveJobDiffResponseSchema.parse({ path: filePath, patch: "" });
    }

    const artifact = await input.db.query.sandboxRunArtifactsTable.findFirst({
      where: and(
        eq(sandboxRunArtifactsTable.sandboxRunId, runId),
        eq(sandboxRunArtifactsTable.name, "git-diff.patch"),
      ),
    });

    if (!artifact) {
      return liveJobDiffResponseSchema.parse({ path: filePath, patch: "" });
    }

    const raw = await input.artifactStorageService.readArtifact(artifact.storagePath);
    const patch = raw.toString("utf8");
    const sections = patch.split(/^diff --git /m);
    const matching = sections.find((section) =>
      section.includes(` b/${filePath}\n`) || section.includes(` a/${filePath}\n`),
    );

    return liveJobDiffResponseSchema.parse({
      path: filePath,
      patch: matching ? `diff --git ${matching}` : "",
    });
  },
});

export type JobTraceService = ReturnType<typeof createJobTraceService>;
