import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  createSandboxRunRequestSchema,
  disposeManagedContainerRequestSchema,
  executionSettingsSchema,
  managedContainerListResponseSchema,
  managedContainerSummarySchema,
  sandboxMilestoneSessionListResponseSchema,
  sandboxMilestoneSessionSchema,
  sandboxMilestoneSessionTaskSchema,
  sandboxOptionsSchema,
  sandboxRunDetailResponseSchema,
  sandboxRunEventSchema,
  sandboxRunListResponseSchema,
  sandboxRunSchema,
  type ContextPack,
  type ManagedContainerSummary,
  type SandboxMilestoneSession,
  type SandboxRun,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import {
  contextPacksTable,
  featureCasesTable,
  featureDeliveryTasksTable,
  featureRevisionsTable,
  featureTaskPlanningSessionsTable,
  featureTechRevisionsTable,
  implementationRecordsTable,
  jobsTable,
  milestoneDesignDocsTable,
  milestonesTable,
  onePagersTable,
  projectReviewAttemptsTable,
  projectReviewFindingsTable,
  projectsTable,
  reposTable,
  sandboxMilestoneSessionsTable,
  sandboxMilestoneSessionTasksTable,
  sandboxRunArtifactsTable,
  sandboxRunEventsTable,
  sandboxRunsTable,
  settingsTable,
} from "../db/schema.js";
import { PROJECT_SETTING_KEYS } from "./project-setup-service.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { ArtifactStorageService } from "./artifact-storage-service.js";
import type { ContextPackService } from "./context-pack-service.js";
import type { DockerService } from "./docker-service.js";
import type { ExecutionSettingsService } from "./execution-settings-service.js";
import type { FeatureService } from "./feature-service.js";
import type { FeatureWorkstreamService } from "./feature-workstream-service.js";
import type { GithubService } from "./github-service.js";
import type { ProviderDefinition } from "./llm-provider.js";
import {
  buildMilestoneDeliveryBranchName,
  buildPostMergeFixBranchName,
  orderMilestoneFeatures,
} from "./milestone-delivery-branch.js";
import type { SecretService } from "./secret-service.js";
import type { SseHub } from "./sse.js";
import type { TaskPlanningService } from "./task-planning-service.js";

const execFileAsync = promisify(execFile);
const gitUserEnv = {
  GIT_AUTHOR_EMAIL: "quayboard@local.invalid",
  GIT_AUTHOR_NAME: "Quayboard",
  GIT_COMMITTER_EMAIL: "quayboard@local.invalid",
  GIT_COMMITTER_NAME: "Quayboard",
  GIT_TERMINAL_PROMPT: "0",
};

const sandboxWorkspacePrefix = "quayboard-run-";
const managedGitignoreStart = "# --- Quayboard managed ignore entries ---";
const managedGitignoreEnd = "# --- End Quayboard managed ignore entries ---";
const managedGitignoreEntries = [
  ".quayboard-context.md",
  ".quayboard-tasks.md",
  ".quayboard-ci-failure.md",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  ".nyc_output/",
  "*.log",
  ".env",
  ".env.local",
] as const;
const protectedPublishPaths = [
  "docs/",
  "README.md",
  "CHANGELOG.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  ".github/",
  ".gitignore",
] as const;
const excludedPublishPaths = [
  ".quayboard-context.md",
  ".quayboard-tasks.md",
  ".quayboard-ci-failure.md",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  ".nyc_output/",
] as const;
const interruptedSandboxRunReason =
  "The API restarted before this sandbox run finished, so the run was cancelled.";
const shutdownSandboxRunReason =
  "The API shut down before this sandbox run finished, so the run was cancelled.";
const transientGitMessageFiles = ["COMMIT_EDITMSG", "MERGE_MSG", "SQUASH_MSG"] as const;
const projectReviewFixBranchName = "quayboard/project-review-fixes";

type ProjectReviewFixFindingRecord = Pick<
  typeof projectReviewFindingsTable.$inferSelect,
  | "id"
  | "category"
  | "severity"
  | "finding"
  | "evidence"
  | "whyItMatters"
  | "recommendedImprovement"
  | "status"
>;

const isIsoString = (value: string) => !Number.isNaN(new Date(value).getTime());

const toSandboxRunEvent = (
  record: typeof sandboxRunEventsTable.$inferSelect,
) =>
  sandboxRunEventSchema.parse({
    id: record.id,
    sandboxRunId: record.sandboxRunId,
    sequence: record.sequence,
    level: record.level,
    type: record.type,
    message: record.message,
    payload: record.payload ?? null,
    createdAt: record.createdAt.toISOString(),
  });

const mapArtifact = (record: typeof sandboxRunArtifactsTable.$inferSelect) => ({
  name: record.name,
  contentType: record.contentType,
  sizeBytes: record.sizeBytes,
  createdAt: record.createdAt.toISOString(),
});

type DeliveryBranchPlan = {
  baseBranchName: string;
  cloneBranchName: string;
  pullRequestBody: string;
  pullRequestTitle: string;
  targetBranchName: string;
};

const toManagedContainer = (record: Record<string, string>): ManagedContainerSummary =>
  managedContainerSummarySchema.parse({
    id: record.ID,
    image: record.Image,
    name: record.Names ?? null,
    state: record.State ?? "unknown",
    status: record.Status ?? "unknown",
    sandboxRunId: record.Labels
      ?.split(",")
      .find((entry) => entry.startsWith("quayboard.sandbox_run_id="))
      ?.split("=")[1] ?? null,
    createdAt:
      typeof record.CreatedAt === "string" && isIsoString(record.CreatedAt)
        ? new Date(record.CreatedAt).toISOString()
        : null,
  });

const buildAuthenticatedRepoUrl = (repoUrl: string, token: string) =>
  repoUrl.replace("https://github.com/", `https://x-access-token:${token}@github.com/`);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitizeSecretText = (value: string, secrets: string[]) => {
  let sanitized = value.replace(
    /(https:\/\/[^:\s]+:)[^@\s]+@/g,
    "$1[redacted]@",
  );

  for (const secret of secrets.filter((entry) => entry.trim().length > 0)) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(secret), "g"), "[redacted]");
  }

  return sanitized;
};

const sanitizeGitError = (error: unknown, secrets: string[]) => {
  const message =
    error instanceof Error
      ? sanitizeSecretText(error.message, secrets)
      : sanitizeSecretText(String(error), secrets);
  const sanitized = new Error(message);

  if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      for (const key of ["code", "category", "retryable"] as const) {
        if (key in record) {
          (sanitized as unknown as Record<string, unknown>)[key] = record[key];
        }
      }
    }

  return sanitized;
};

const replaceManagedBlock = (existing: string, entries: readonly string[]) => {
  const managedBlock = [managedGitignoreStart, ...entries, managedGitignoreEnd].join("\n");
  const blockPattern = new RegExp(
    `${escapeRegExp(managedGitignoreStart)}[\\s\\S]*?${escapeRegExp(managedGitignoreEnd)}\\n?`,
    "m",
  );

  if (blockPattern.test(existing)) {
    return existing.replace(blockPattern, `${managedBlock}\n`);
  }

  if (existing.trim().length === 0) {
    return `${managedBlock}\n`;
  }

  return `${existing.replace(/\s*$/, "\n\n")}${managedBlock}\n`;
};

const getErrorText = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  const record = error as Record<string, unknown>;
  return [record.message, record.stderr, record.stdout]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
};

export const serializeProjectReviewFixFindings = (
  findings: ProjectReviewFixFindingRecord[],
) =>
  JSON.stringify(
    findings
      .filter((finding) => finding.status === "open")
      .map((finding) => ({
        id: finding.id,
        category: finding.category,
        severity: finding.severity,
        finding: finding.finding,
        evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
        whyItMatters: finding.whyItMatters,
        recommendedImprovement: finding.recommendedImprovement,
        status: finding.status,
      })),
    null,
    2,
  );

const isMissingRemoteBranchError = (error: unknown, branch: string) => {
  const text = getErrorText(error);
  return (
    text.includes(`Remote branch ${branch} not found`) ||
    text.includes(`fatal: Remote branch ${branch} not found in upstream origin`)
  );
};

const isLocalHostName = (hostname: string) =>
  hostname === "127.0.0.1" ||
  hostname === "localhost" ||
  hostname === "::1" ||
  hostname === "host.docker.internal";

const determineNetworkModeForModel = (
  provider: ProviderDefinition["provider"],
  baseUrl: string | null,
  egressPolicy: "allowlisted" | "locked",
) => {
  if (!baseUrl) {
    return "none" as const;
  }

  try {
    const url = new URL(baseUrl);
    const isLocal = isLocalHostName(url.hostname);

    if (isLocal) {
      return "host" as const;
    }

    return egressPolicy === "locked" ? "none" as const : "bridge" as const;
  } catch {
    return egressPolicy === "locked" ? "none" as const : "bridge" as const;
  }
};

const normalizeModelBaseUrl = (
  provider: ProviderDefinition["provider"],
  baseUrl: string | null,
  networkMode: "bridge" | "host" | "none",
) => {
  if (!baseUrl) {
    return "";
  }

  const normalized =
    provider === "ollama" && !baseUrl.endsWith("/v1") ? `${baseUrl.replace(/\/$/, "")}/v1` : baseUrl;

  if (networkMode === "host") {
    return normalized;
  }

  return normalized
    .replace("://127.0.0.1", "://host.docker.internal")
    .replace("://localhost", "://host.docker.internal")
    .replace("://[::1]", "://host.docker.internal");
};

const createHandledRunFailure = (message: string) =>
  Object.assign(new Error(message), { sandboxRunFailed: true as const });

const isHandledRunFailure = (error: unknown): error is Error & { sandboxRunFailed: true } =>
  Boolean(
    error &&
      typeof error === "object" &&
      "sandboxRunFailed" in error &&
      (error as { sandboxRunFailed?: unknown }).sandboxRunFailed === true,
  );

const isDockerWaitTimeoutError = (
  error: unknown,
): error is Error & {
  code: "docker_wait_timeout";
  containerId: string;
  timeoutMs: number;
} =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "docker_wait_timeout",
  );

export const createSandboxService = (input: {
  artifactStorageService: ArtifactStorageService;
  contextPackService: ContextPackService;
  db: AppDatabase;
  dockerService: DockerService;
  executionSettingsService: ExecutionSettingsService;
  featureService: FeatureService;
  featureWorkstreamService: FeatureWorkstreamService;
  githubService: GithubService;
  llmRuntimeDefaults: {
    ollamaHost: string;
    openAiBaseUrl: string;
  };
  secretService: SecretService;
  sseHub: SseHub;
  taskPlanningService: TaskPlanningService;
}) => ({
  async assertOwnedProject(ownerUserId: string, projectId: string) {
    const project = await input.db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.ownerUserId, ownerUserId),
      ),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    return project;
  },

  async assertOwnedRun(ownerUserId: string, runId: string) {
    const [record] = await input.db
      .select({
        ownerUserId: projectsTable.ownerUserId,
        run: sandboxRunsTable,
      })
      .from(sandboxRunsTable)
      .innerJoin(projectsTable, eq(projectsTable.id, sandboxRunsTable.projectId))
      .where(eq(sandboxRunsTable.id, runId))
      .limit(1);

    if (!record || record.ownerUserId !== ownerUserId) {
      throw new HttpError(404, "sandbox_run_not_found", "Sandbox run not found.");
    }

    return record.run;
  },

  async getEffectiveSandboxConfig(projectId: string) {
    const executionSettings = await input.executionSettingsService.get();
    const raw = await input.db.query.settingsTable.findFirst({
      where: and(
        eq(settingsTable.scope, "project"),
        eq(settingsTable.scopeId, projectId),
        eq(settingsTable.key, PROJECT_SETTING_KEYS.sandbox),
      ),
    });

    const value = (raw?.value ?? null) as
      | {
          allowlist?: string[];
          cpuLimit?: number;
          egressPolicy?: "allowlisted" | "locked";
          memoryMb?: number;
          timeoutSeconds?: number;
        }
      | null;

    return {
      allowlist: value?.allowlist ?? [],
      cpuLimit: value?.cpuLimit ?? executionSettings.defaultCpuLimit,
      egressPolicy: value?.egressPolicy ?? "locked",
      memoryMb: value?.memoryMb ?? executionSettings.defaultMemoryMb,
      timeoutSeconds:
        value?.timeoutSeconds ?? executionSettings.defaultTimeoutSeconds,
    };
  },

  async getEffectiveLlmDefinition(ownerUserId: string, projectId: string): Promise<ProviderDefinition> {
    const raw = await input.db.query.settingsTable.findFirst({
      where: and(
        eq(settingsTable.scope, "project"),
        eq(settingsTable.scopeId, projectId),
        eq(settingsTable.key, PROJECT_SETTING_KEYS.llm),
      ),
    });

    const value = (raw?.value ?? null) as
      | {
          model?: string;
          provider?: "ollama" | "openai";
        }
      | null;

    if (!value?.model || !value.provider) {
      throw new HttpError(409, "llm_not_configured", "LLM settings are incomplete.");
    }

    const envMap = await input.secretService.buildSecretEnvMap(ownerUserId, projectId);

    return value.provider === "ollama"
      ? {
          provider: "ollama",
          model: value.model,
          baseUrl: input.llmRuntimeDefaults.ollamaHost,
          apiKey: null,
        }
      : {
          provider: "openai",
          model: value.model,
          baseUrl: input.llmRuntimeDefaults.openAiBaseUrl,
          apiKey: envMap.LLM_API_KEY ?? null,
        };
  },

  async listRuns(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const runs = await input.db.query.sandboxRunsTable.findMany({
      where: eq(sandboxRunsTable.projectId, projectId),
      orderBy: [desc(sandboxRunsTable.createdAt)],
    });

    return sandboxRunListResponseSchema.parse({
      runs: await Promise.all(runs.map((run) => this.formatRun(run))),
    });
  },

  async getRun(ownerUserId: string, runId: string) {
    const run = await this.assertOwnedRun(ownerUserId, runId);
    const events = await input.db.query.sandboxRunEventsTable.findMany({
      where: eq(sandboxRunEventsTable.sandboxRunId, runId),
      orderBy: [asc(sandboxRunEventsTable.sequence)],
    });

    return sandboxRunDetailResponseSchema.parse({
      run: await this.formatRun(run),
      events: events.map(toSandboxRunEvent),
    });
  },

  async formatRun(record: typeof sandboxRunsTable.$inferSelect): Promise<SandboxRun> {
    const [artifacts, latestEvent] = await Promise.all([
      input.db.query.sandboxRunArtifactsTable.findMany({
        where: eq(sandboxRunArtifactsTable.sandboxRunId, record.id),
        orderBy: [asc(sandboxRunArtifactsTable.createdAt)],
      }),
      input.db.query.sandboxRunEventsTable.findFirst({
        where: eq(sandboxRunEventsTable.sandboxRunId, record.id),
        orderBy: [desc(sandboxRunEventsTable.sequence)],
      }),
    ]);

    return sandboxRunSchema.parse({
      id: record.id,
      projectId: record.projectId,
      featureId: record.featureId ?? null,
      milestoneId: record.milestoneId ?? null,
      taskPlanningSessionId: record.taskPlanningSessionId ?? null,
      contextPackId: record.contextPackId ?? null,
      triggeredByJobId: record.triggeredByJobId ?? null,
      kind: record.kind,
      status: record.status,
      outcome: record.outcome ?? null,
      containerId: record.containerId ?? null,
      baseCommitSha: record.baseCommitSha ?? null,
      headCommitSha: record.headCommitSha ?? null,
      branchName: record.branchName ?? null,
      pullRequestUrl: record.pullRequestUrl ?? null,
      cancellationReason: record.cancellationReason ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      artifacts: artifacts.map(mapArtifact),
      latestEvent: latestEvent ? toSandboxRunEvent(latestEvent) : null,
    });
  },

  async appendEvent(
    sandboxRunId: string,
    level: "info" | "warning" | "error",
    type: string,
    message: string,
    payload: unknown = null,
  ) {
    const latest = await input.db.query.sandboxRunEventsTable.findFirst({
      where: eq(sandboxRunEventsTable.sandboxRunId, sandboxRunId),
      orderBy: [desc(sandboxRunEventsTable.sequence)],
    });

    const [created] = await input.db
      .insert(sandboxRunEventsTable)
      .values({
        id: generateId(),
        sandboxRunId,
        sequence: (latest?.sequence ?? -1) + 1,
        level,
        type,
        message,
        payload,
        createdAt: new Date(),
      })
      .returning();

    const run = await input.db.query.sandboxRunsTable.findFirst({
      where: eq(sandboxRunsTable.id, sandboxRunId),
    });
    const project = run
      ? await input.db.query.projectsTable.findFirst({
          where: eq(projectsTable.id, run.projectId),
        })
      : null;

    if (project) {
      input.sseHub.publish(project.ownerUserId, "sandbox:updated", {
        type: "sandbox:updated",
        projectId: run!.projectId,
        sandboxRunId,
      });
    }

    return toSandboxRunEvent(created);
  },

  async attachArtifact(
    sandboxRunId: string,
    name: string,
    contentType: string,
    storagePath: string,
    sizeBytes: number,
  ) {
    await input.db
      .insert(sandboxRunArtifactsTable)
      .values({
        id: generateId(),
        sandboxRunId,
        name,
        contentType,
        storagePath,
        sizeBytes,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [sandboxRunArtifactsTable.sandboxRunId, sandboxRunArtifactsTable.name],
        set: {
          contentType,
          storagePath,
          sizeBytes,
          createdAt: new Date(),
        },
      });
  },

  async getRunArtifact(ownerUserId: string, runId: string, name: string) {
    await this.assertOwnedRun(ownerUserId, runId);
    const artifact = await input.db.query.sandboxRunArtifactsTable.findFirst({
      where: and(
        eq(sandboxRunArtifactsTable.sandboxRunId, runId),
        eq(sandboxRunArtifactsTable.name, name),
      ),
    });

    if (!artifact) {
      throw new HttpError(404, "sandbox_artifact_not_found", "Artifact not found.");
    }

    return {
      content: await input.artifactStorageService.readArtifact(artifact.storagePath),
      contentType: artifact.contentType,
    };
  },

  async getLatestProjectReviewArtifacts(projectId: string) {
    const latestReviewAttempt = await input.db.query.projectReviewAttemptsTable.findFirst({
      where: and(
        eq(projectReviewAttemptsTable.projectId, projectId),
        eq(projectReviewAttemptsTable.kind, "review"),
        eq(projectReviewAttemptsTable.status, "succeeded"),
      ),
      orderBy: [desc(projectReviewAttemptsTable.createdAt)],
    });

    if (!latestReviewAttempt?.reportMarkdown) {
      throw new Error("Project review remediation requires a completed project review.");
    }

    const findings = await input.db.query.projectReviewFindingsTable.findMany({
      where: eq(projectReviewFindingsTable.projectReviewAttemptId, latestReviewAttempt.id),
      orderBy: [asc(projectReviewFindingsTable.createdAt)],
    });

    return {
      markdown: latestReviewAttempt.reportMarkdown,
      findingsJson: serializeProjectReviewFixFindings(findings),
    };
  },

  async getOptions(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const [executionSettings, repo, features, codingPacks] = await Promise.all([
      input.executionSettingsService.get(),
      input.db.query.reposTable.findFirst({
        where: eq(reposTable.projectId, projectId),
      }),
      input.featureService.list(ownerUserId, projectId),
      input.contextPackService.listContextPacks(ownerUserId, projectId),
    ]);

    const runnableFeatures = await Promise.all(
      features.features.map(async (feature) => {
        const [session, records, activeRun] = await Promise.all([
          input.taskPlanningService.getSession(ownerUserId, feature.id),
          input.taskPlanningService.getImplementationRecords(ownerUserId, feature.id),
          input.db.query.sandboxRunsTable.findFirst({
            where: and(
              eq(sandboxRunsTable.projectId, projectId),
              eq(sandboxRunsTable.featureId, feature.id),
              inArray(sandboxRunsTable.status, ["queued", "running"]),
            ),
            orderBy: [desc(sandboxRunsTable.createdAt)],
          }),
        ]);
        const hasPendingTasks =
          session?.status === "tasks_generated"
            ? (await input.taskPlanningService.getTasks(ownerUserId, session.id)).some(
                (task) => task.status !== "completed",
              )
            : false;
        const latestRecord = records[0] ?? null;
        const latestTechRevisionId = feature.documents.tech.state === "accepted"
          ? (
              await input.db.query.featureTechRevisionsTable.findFirst({
                where: eq(featureTechRevisionsTable.featureId, feature.id),
                orderBy: [desc(featureTechRevisionsTable.version)],
              })
            )?.id ?? null
          : null;
        const implementationStatus =
          activeRun
            ? "running"
            : !latestRecord
              ? "not_implemented"
              : latestTechRevisionId && latestRecord.techRevisionId !== latestTechRevisionId
                ? "out_of_date"
                : "implemented";

        return {
          id: feature.id,
          featureKey: feature.featureKey,
          title: feature.headRevision.title,
          milestoneId: feature.milestoneId,
          milestoneTitle: feature.milestoneTitle,
          hasPendingTasks,
          latestImplementationRunId: latestRecord?.sandboxRunId ?? null,
          latestImplementationStatus: implementationStatus,
        };
      }),
    );

    return sandboxOptionsSchema.parse({
      executionSettings: executionSettingsSchema.parse(executionSettings),
      projectRepo: repo
        ? {
            owner: repo.owner,
            name: repo.name,
            repoUrl: repo.repoUrl,
            defaultBranch: repo.defaultBranch,
          }
        : null,
      runnableFeatures,
      codingPacks: codingPacks
        .filter((pack) => pack.type === "coding")
        .map((pack) => ({
          id: pack.id,
          featureId: pack.featureId,
          type: pack.type,
          version: pack.version,
          stale: pack.stale,
          createdAt: pack.createdAt,
        })),
    });
  },

  async resolveDeliveryBranchPlan(
    ownerUserId: string,
    sandboxRunId: string,
    repo: typeof reposTable.$inferSelect,
    featureId: string,
    token: string,
  ): Promise<DeliveryBranchPlan> {
    if (!repo.owner || !repo.name) {
      throw new Error("Sandbox execution requires a verified GitHub repository.");
    }

    const feature = await input.featureService.get(ownerUserId, featureId);
    const milestone = await input.db.query.milestonesTable.findFirst({
      where: eq(milestonesTable.id, feature.milestoneId),
    });

    if (!milestone) {
      throw new Error("Feature milestone not found.");
    }

    const defaultBranchName = repo.defaultBranch ?? "main";
    const activeMilestone = await input.db.query.milestonesTable.findFirst({
      where: and(
        eq(milestonesTable.projectId, feature.projectId),
        inArray(milestonesTable.status, ["draft", "approved"]),
      ),
      orderBy: [asc(milestonesTable.position)],
    });

    if (activeMilestone?.id === milestone.id && milestone.status === "approved") {
      const targetBranchName = buildMilestoneDeliveryBranchName(milestone);
      const branchExists = await input.githubService.branchExists({
        owner: repo.owner,
        repo: repo.name,
        token,
        branch: targetBranchName,
      });

      return {
        baseBranchName: defaultBranchName,
        cloneBranchName: branchExists ? targetBranchName : defaultBranchName,
        targetBranchName,
        pullRequestTitle: `Deliver Milestone ${milestone.position}: ${milestone.title}`,
        pullRequestBody: `Automated milestone delivery branch for ${milestone.title}.`,
      };
    }

    const targetBranchName = buildPostMergeFixBranchName(feature.featureKey, sandboxRunId);
    return {
      baseBranchName: defaultBranchName,
      cloneBranchName: defaultBranchName,
      targetBranchName,
      pullRequestTitle: `Fix ${feature.featureKey}: ${feature.headRevision.title}`,
      pullRequestBody: `Automated follow-up fix run ${sandboxRunId}.`,
    };
  },

  async resolveMilestoneRepairBranchPlan(
    repo: typeof reposTable.$inferSelect,
    milestoneId: string,
    token: string,
  ): Promise<DeliveryBranchPlan> {
    if (!repo.owner || !repo.name) {
      throw new Error("Sandbox execution requires a verified GitHub repository.");
    }

    const milestone = await input.db.query.milestonesTable.findFirst({
      where: eq(milestonesTable.id, milestoneId),
    });
    if (!milestone) {
      throw new Error("Milestone not found.");
    }

    const defaultBranchName = repo.defaultBranch ?? "main";
    const targetBranchName = buildMilestoneDeliveryBranchName(milestone);
    const branchExists = await input.githubService.branchExists({
      owner: repo.owner,
      repo: repo.name,
      token,
      branch: targetBranchName,
    });

    return {
      baseBranchName: defaultBranchName,
      cloneBranchName: branchExists ? targetBranchName : defaultBranchName,
      targetBranchName,
      pullRequestTitle: `Deliver Milestone ${milestone.position}: ${milestone.title}`,
      pullRequestBody: `Automated milestone delivery branch for ${milestone.title}.`,
    };
  },

  async resolveProjectReviewBranchPlan(
    repo: typeof reposTable.$inferSelect,
    token: string,
    targetBranchName = projectReviewFixBranchName,
  ): Promise<DeliveryBranchPlan> {
    if (!repo.owner || !repo.name) {
      throw new Error("Sandbox execution requires a verified GitHub repository.");
    }

    const defaultBranchName = repo.defaultBranch ?? "main";
    const branchExists = await input.githubService.branchExists({
      owner: repo.owner,
      repo: repo.name,
      token,
      branch: targetBranchName,
    });

    return {
      baseBranchName: defaultBranchName,
      cloneBranchName: branchExists ? targetBranchName : defaultBranchName,
      targetBranchName,
      pullRequestTitle: "Project review remediation",
      pullRequestBody: "Automated project review remediation branch.",
    };
  },

  async createRun(
    ownerUserId: string,
    projectId: string,
    request:
      | { featureId: string; kind: "implement" | "verify" }
      | { milestoneId: string; kind: "ci_repair" }
      | { kind: "project_review"; branchName?: string }
      | { kind: "project_fix"; branchName?: string },
    triggeredByJobId: string | null = null,
    jobInputs: Record<string, unknown> | null = null,
  ) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const payload =
      request.kind === "ci_repair" || request.kind === "project_review" || request.kind === "project_fix"
        ? request
        : createSandboxRunRequestSchema.parse(request);
    const feature =
      "featureId" in payload
        ? await input.featureService.get(ownerUserId, payload.featureId)
        : null;
    if (feature && feature.projectId !== projectId) {
      throw new HttpError(404, "feature_not_found", "Feature not found.");
    }

    const session =
      "featureId" in payload
        ? await input.taskPlanningService.getSession(ownerUserId, payload.featureId)
        : null;
    if ("featureId" in payload && !session) {
      throw new HttpError(
        409,
        "task_planning_session_required",
        "Task planning must be completed before running sandbox execution.",
      );
    }

    const pack = await input.contextPackService.buildContextPack(ownerUserId, projectId, {
      featureId: "featureId" in payload ? payload.featureId : undefined,
      type: "coding",
      createdByJobId: triggeredByJobId,
    });

    const [created] = await input.db
      .insert(sandboxRunsTable)
      .values({
        id: generateId(),
        projectId,
        featureId: "featureId" in payload ? payload.featureId : null,
        milestoneId: feature?.milestoneId ?? ("milestoneId" in payload ? payload.milestoneId : null),
        taskPlanningSessionId: session?.id ?? null,
        contextPackId: pack.id,
        triggeredByJobId,
        kind: payload.kind,
        status: "queued",
        outcome: null,
        branchName: "branchName" in payload ? payload.branchName ?? null : null,
        createdAt: new Date(),
      })
      .returning();

    if (!triggeredByJobId) {
      await input.db.insert(jobsTable).values({
        id: generateId(),
        projectId,
        createdByUserId: ownerUserId,
        parentJobId: null,
        dependencyJobId: null,
        type:
          payload.kind === "implement"
            ? "ImplementChange"
            : payload.kind === "verify"
              ? "TestAndVerify"
              : "RepairMilestoneCi",
        status: "queued",
        inputs: { ...(jobInputs ?? {}), sandboxRunId: created.id },
        outputs: null,
        error: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
      });
    }

    await this.appendEvent(
      created.id,
      "info",
      "queued",
      `Queued ${payload.kind} sandbox run.`,
    );

    return this.formatRun(created);
  },

  async createProjectReviewRun(
    ownerUserId: string,
    projectId: string,
    triggeredByJobId: string | null = null,
    branchName: string | null = null,
  ) {
    return this.createRun(
      ownerUserId,
      projectId,
      {
        kind: "project_review",
        branchName: branchName ?? undefined,
      },
      triggeredByJobId,
    );
  },

  async createProjectFixRun(
    ownerUserId: string,
    projectId: string,
    triggeredByJobId: string | null = null,
    branchName: string | null = projectReviewFixBranchName,
  ) {
    return this.createRun(
      ownerUserId,
      projectId,
      {
        kind: "project_fix",
        branchName: branchName ?? undefined,
      },
      triggeredByJobId,
    );
  },

  async createMilestoneCiRepairRun(
    ownerUserId: string,
    projectId: string,
    milestoneId: string,
    triggeredByJobId: string | null = null,
  ) {
    return this.createRun(
      ownerUserId,
      projectId,
      {
        milestoneId,
        kind: "ci_repair",
      },
      triggeredByJobId,
    );
  },

  async updateRunState(
    sandboxRunId: string,
    patch: Partial<typeof sandboxRunsTable.$inferInsert>,
  ) {
    const [updated] = await input.db
      .update(sandboxRunsTable)
      .set(patch)
      .where(eq(sandboxRunsTable.id, sandboxRunId))
      .returning();

    return updated;
  },

  async cleanupTempWorkspaces(activeWorkspacePaths: string[] = []) {
    const protectedPaths = new Set(activeWorkspacePaths);
    const entries = await readdir(tmpdir(), { withFileTypes: true }).catch(() => []);

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(sandboxWorkspacePrefix))
        .map(async (entry) => {
          const workspacePath = path.join(tmpdir(), entry.name);
          if (protectedPaths.has(workspacePath)) {
            return;
          }

          await rm(workspacePath, { force: true, recursive: true }).catch(() => undefined);
        }),
    );
  },

  async pruneWorkspaceSnapshots(featureId?: string | null) {
    const runs = await input.db.query.sandboxRunsTable.findMany({
      where:
        featureId
          ? and(
              eq(sandboxRunsTable.kind, "implement"),
              eq(sandboxRunsTable.featureId, featureId),
            )
          : eq(sandboxRunsTable.kind, "implement"),
      orderBy: [desc(sandboxRunsTable.completedAt), desc(sandboxRunsTable.createdAt)],
    });

    const newestSuccessfulSnapshotByFeature = new Set<string>();

    for (const run of runs) {
      if (!run.workspaceArchivePath || !run.featureId) {
        continue;
      }

      const keepSnapshot =
        run.status === "succeeded" && !newestSuccessfulSnapshotByFeature.has(run.featureId);

      if (keepSnapshot) {
        newestSuccessfulSnapshotByFeature.add(run.featureId);
        continue;
      }

      await input.artifactStorageService.deletePath(run.workspaceArchivePath).catch(() => undefined);
      await this.updateRunState(run.id, {
        workspaceArchivePath: null,
      }).catch(() => undefined);
    }
  },

  async reconcileRuntimeState(reason = interruptedSandboxRunReason) {
    const executionSettings = executionSettingsSchema.parse(
      await input.executionSettingsService.get(),
    );
    const managedContainers = await input.dockerService
      .listManagedContainers({
        dockerHost: executionSettings.dockerHost,
      })
      .catch(() => [] as Record<string, string>[]);
    const activeWorkspacePaths = managedContainers
      .map((container) =>
        container.Labels
          ?.split(",")
          .find((entry) => entry.startsWith("quayboard.workspace="))
          ?.slice("quayboard.workspace=".length) ?? null,
      )
      .filter((value): value is string => Boolean(value));

    await Promise.all(
      managedContainers.map((container) =>
        input.dockerService
          .removeContainer(container.ID, {
            dockerHost: executionSettings.dockerHost,
            force: true,
          })
          .catch(() => undefined),
      ),
    );

    const runningRuns = await input.db.query.sandboxRunsTable.findMany({
      where: eq(sandboxRunsTable.status, "running"),
      orderBy: [asc(sandboxRunsTable.createdAt)],
    });

    await Promise.all(
      runningRuns.map(async (run) => {
        await this.updateRunState(run.id, {
          status: "cancelled",
          outcome: "cancelled",
          cancellationReason: reason,
          completedAt: new Date(),
          containerId: null,
        });
        await this.appendEvent(run.id, "warning", "cancelled", reason).catch(() => undefined);
      }),
    );

    await input.db
      .update(sandboxRunsTable)
      .set({
        containerId: null,
      })
      .where(
        and(
          inArray(sandboxRunsTable.status, ["failed", "succeeded", "cancelled"]),
          sql`${sandboxRunsTable.containerId} is not null`,
        ),
      );

    await this.cleanupTempWorkspaces(activeWorkspacePaths);
    await this.pruneWorkspaceSnapshots();
    await input.dockerService.pruneManagedResources({
      dockerHost: executionSettings.dockerHost,
    });
  },

  async cancelRun(ownerUserId: string, runId: string, reason: string | null = null) {
    const run = await this.assertOwnedRun(ownerUserId, runId);
    if (run.status === "cancelled" || run.status === "failed" || run.status === "succeeded") {
      return this.formatRun(run);
    }

    if (run.containerId) {
      await input.dockerService.stopContainer(run.containerId).catch(() => undefined);
      await input.dockerService.removeContainer(run.containerId, { force: true }).catch(() => undefined);
    }

    const updated = await this.updateRunState(runId, {
      status: "cancelled",
      outcome: "cancelled",
      cancellationReason: reason,
      completedAt: new Date(),
    });

    await this.appendEvent(runId, "warning", "cancelled", reason ?? "Run cancelled.");
    return this.formatRun(updated);
  },

  async listManagedContainers(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const executionSettings = await input.executionSettingsService.get();
    const raw = await input.dockerService.listManagedContainers({
      projectId,
      dockerHost: executionSettings.dockerHost,
    });

    return managedContainerListResponseSchema.parse({
      containers: raw.map(toManagedContainer),
    });
  },

  async disposeManagedContainer(ownerUserId: string, projectId: string, containerId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const executionSettings = await input.executionSettingsService.get();
    const payload = disposeManagedContainerRequestSchema.parse({ containerId });
    await input.dockerService.removeContainer(payload.containerId, {
      dockerHost: executionSettings.dockerHost,
      force: true,
    });
  },

  async listMilestoneSessions(ownerUserId: string, milestoneId: string) {
    const milestone = await input.db.query.milestonesTable.findFirst({
      where: eq(milestonesTable.id, milestoneId),
    });
    if (!milestone) {
      throw new HttpError(404, "milestone_not_found", "Milestone not found.");
    }

    await this.assertOwnedProject(ownerUserId, milestone.projectId);
    const sessions = await input.db.query.sandboxMilestoneSessionsTable.findMany({
      where: eq(sandboxMilestoneSessionsTable.milestoneId, milestoneId),
      orderBy: [desc(sandboxMilestoneSessionsTable.createdAt)],
    });

    return sandboxMilestoneSessionListResponseSchema.parse({
      sessions: await Promise.all(sessions.map((session) => this.formatMilestoneSession(session))),
    });
  },

  async getMilestoneSession(ownerUserId: string, sandboxMilestoneSessionId: string) {
    const session = await input.db.query.sandboxMilestoneSessionsTable.findFirst({
      where: eq(sandboxMilestoneSessionsTable.id, sandboxMilestoneSessionId),
    });

    if (!session) {
      throw new HttpError(
        404,
        "sandbox_milestone_session_not_found",
        "Sandbox milestone session not found.",
      );
    }

    await this.assertOwnedProject(ownerUserId, session.projectId);
    return this.formatMilestoneSession(session);
  },

  async formatMilestoneSession(record: typeof sandboxMilestoneSessionsTable.$inferSelect): Promise<SandboxMilestoneSession> {
    const tasks = await input.db
      .select({
        task: sandboxMilestoneSessionTasksTable,
        revision: featureRevisionsTable,
      })
      .from(sandboxMilestoneSessionTasksTable)
      .innerJoin(featureCasesTable, eq(featureCasesTable.id, sandboxMilestoneSessionTasksTable.featureId))
      .innerJoin(featureRevisionsTable, eq(featureRevisionsTable.featureId, featureCasesTable.id))
      .where(eq(sandboxMilestoneSessionTasksTable.sandboxMilestoneSessionId, record.id))
      .orderBy(asc(sandboxMilestoneSessionTasksTable.position), desc(featureRevisionsTable.version));

    const uniqueTasks = new Map<string, (typeof tasks)[number]>();
    for (const task of tasks) {
      if (!uniqueTasks.has(task.task.id)) {
        uniqueTasks.set(task.task.id, task);
      }
    }

    return sandboxMilestoneSessionSchema.parse({
      id: record.id,
      projectId: record.projectId,
      milestoneId: record.milestoneId,
      status: record.status,
      triggeredByJobId: record.triggeredByJobId ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      tasks: Array.from(uniqueTasks.values()).map(({ task, revision }) =>
        sandboxMilestoneSessionTaskSchema.parse({
          id: task.id,
          sandboxMilestoneSessionId: task.sandboxMilestoneSessionId,
          featureId: task.featureId,
          featureTitle: revision.title,
          position: task.position,
          sandboxRunId: task.sandboxRunId ?? null,
          status: task.status,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        }),
      ),
    });
  },

  async createMilestoneSession(ownerUserId: string, milestoneId: string) {
    const milestone = await input.db.query.milestonesTable.findFirst({
      where: eq(milestonesTable.id, milestoneId),
    });
    if (!milestone) {
      throw new HttpError(404, "milestone_not_found", "Milestone not found.");
    }

    await this.assertOwnedProject(ownerUserId, milestone.projectId);
    const features = await input.featureService.list(ownerUserId, milestone.projectId);
    const milestoneFeatures = orderMilestoneFeatures(
      features.features.filter((feature) => feature.milestoneId === milestoneId),
    );
    const now = new Date();

    const [session] = await input.db
      .insert(sandboxMilestoneSessionsTable)
      .values({
        id: generateId(),
        projectId: milestone.projectId,
        milestoneId,
        triggeredByJobId: null,
        status: "queued",
        startedAt: null,
        completedAt: null,
        createdAt: now,
      })
      .returning();

    for (let index = 0; index < milestoneFeatures.length; index += 1) {
      await input.db.insert(sandboxMilestoneSessionTasksTable).values({
        id: generateId(),
        sandboxMilestoneSessionId: session.id,
        featureId: milestoneFeatures[index]!.id,
        position: index,
        sandboxRunId: null,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
    }

    await input.db.insert(jobsTable).values({
      id: generateId(),
      projectId: milestone.projectId,
      createdByUserId: ownerUserId,
      parentJobId: null,
      dependencyJobId: null,
      type: "ExecuteMilestoneSession",
      status: "queued",
      inputs: { sandboxMilestoneSessionId: session.id },
      outputs: null,
      error: null,
      queuedAt: now,
      startedAt: null,
      completedAt: null,
    });

    return this.formatMilestoneSession(session);
  },

  async runMilestoneSession(jobId: string, sandboxMilestoneSessionId: string) {
    const session = await input.db.query.sandboxMilestoneSessionsTable.findFirst({
      where: eq(sandboxMilestoneSessionsTable.id, sandboxMilestoneSessionId),
    });
    if (!session) {
      throw new Error("Sandbox milestone session not found.");
    }

    const project = await input.db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, session.projectId),
    });
    if (!project) {
      throw new Error("Project not found.");
    }

    await input.db
      .update(sandboxMilestoneSessionsTable)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(sandboxMilestoneSessionsTable.id, sandboxMilestoneSessionId));

    const tasks = await input.db.query.sandboxMilestoneSessionTasksTable.findMany({
      where: eq(sandboxMilestoneSessionTasksTable.sandboxMilestoneSessionId, sandboxMilestoneSessionId),
      orderBy: [asc(sandboxMilestoneSessionTasksTable.position)],
    });

    for (const task of tasks) {
      await input.db
        .update(sandboxMilestoneSessionTasksTable)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(sandboxMilestoneSessionTasksTable.id, task.id));

      const run = await this.createRun(project.ownerUserId, session.projectId, {
        featureId: task.featureId,
        kind: "implement",
      }, jobId);

      await input.db
        .update(sandboxMilestoneSessionTasksTable)
        .set({
          sandboxRunId: run.id,
          updatedAt: new Date(),
        })
        .where(eq(sandboxMilestoneSessionTasksTable.id, task.id));

      await this.executeRun(jobId, run.id);
      const finished = await input.db.query.sandboxRunsTable.findFirst({
        where: eq(sandboxRunsTable.id, run.id),
      });

      await input.db
        .update(sandboxMilestoneSessionTasksTable)
        .set({
          status: finished?.status ?? "failed",
          updatedAt: new Date(),
        })
        .where(eq(sandboxMilestoneSessionTasksTable.id, task.id));

      if (finished?.status !== "succeeded") {
        await input.db
          .update(sandboxMilestoneSessionsTable)
          .set({
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(sandboxMilestoneSessionsTable.id, sandboxMilestoneSessionId));
        return;
      }
    }

    await input.db
      .update(sandboxMilestoneSessionsTable)
      .set({
        status: "succeeded",
        completedAt: new Date(),
      })
      .where(eq(sandboxMilestoneSessionsTable.id, sandboxMilestoneSessionId));
  },

  async executeRun(
    jobId: string,
    sandboxRunId: string,
    options: {
      cleanupWorkspaceRootOnExit?: boolean;
      workspaceDir?: string;
      workspaceRoot?: string;
    } = {},
  ) {
    const run = await input.db.query.sandboxRunsTable.findFirst({
      where: eq(sandboxRunsTable.id, sandboxRunId),
    });
    if (!run) {
      throw new Error("Sandbox run not found.");
    }

    const project = await input.db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, run.projectId),
    });
    const repo = await input.db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, run.projectId),
    });

    if (!project || !repo || !repo.repoUrl || !repo.owner || !repo.name) {
      throw new Error("Sandbox execution requires a verified project repository.");
    }

    const executionSettings = executionSettingsSchema.parse(
      await input.executionSettingsService.get(),
    );
    const sandboxConfig = await this.getEffectiveSandboxConfig(run.projectId);
    let secretEnv: Record<string, string> = {};
    let secretsToRedact: string[] = [];

    secretEnv = await input.secretService.buildSecretEnvMap(
      project.ownerUserId,
      run.projectId,
    );
    secretsToRedact = [secretEnv.GITHUB_PAT ?? ""];

    if (!secretEnv.GITHUB_PAT) {
      throw new Error("Sandbox execution requires a GitHub PAT.");
    }

    const workspaceRoot =
      options.workspaceRoot ?? await mkdtemp(path.join(tmpdir(), sandboxWorkspacePrefix));
    const workspaceDir = options.workspaceDir ?? path.join(workspaceRoot, "workspace");
    const artifactDir = path.join(workspaceRoot, `artifacts-${sandboxRunId}`);
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(artifactDir, { recursive: true });
    let cleanupWorkspaceRootOnExit = options.cleanupWorkspaceRootOnExit ?? true;
    let runFinalized = false;
    const defaultBranchName = repo.defaultBranch ?? "main";
    const deliveryBranchPlan = run.featureId
      ? await this.resolveDeliveryBranchPlan(
          project.ownerUserId,
          sandboxRunId,
          repo,
          run.featureId,
          secretEnv.GITHUB_PAT,
        )
      : run.kind === "ci_repair" && run.milestoneId
        ? await this.resolveMilestoneRepairBranchPlan(
            repo,
            run.milestoneId,
            secretEnv.GITHUB_PAT,
          )
        : run.kind === "project_fix"
          ? await this.resolveProjectReviewBranchPlan(
              repo,
              secretEnv.GITHUB_PAT,
              run.branchName ?? projectReviewFixBranchName,
            )
        : null;

    const cleanup = async () => {
      if (!cleanupWorkspaceRootOnExit) {
        return;
      }

      await rm(workspaceRoot, { force: true, recursive: true }).catch(() => undefined);
    };

    try {
      await this.updateRunState(sandboxRunId, {
        status: "running",
        startedAt: new Date(),
        triggeredByJobId: jobId,
      });
      await this.appendEvent(sandboxRunId, "info", "starting", "Starting sandbox run.");

      const contextPack =
        run.contextPackId
          ? await input.db.query.contextPacksTable.findFirst({
              where: eq(contextPacksTable.id, run.contextPackId),
            })
          : null;

      const packFromStore =
        contextPack
          ? (
              await input.contextPackService.listContextPacks(
                project.ownerUserId,
                run.projectId,
                run.featureId,
              )
            ).find((entry) => entry.id === contextPack.id) ?? null
          : null;
      const pack: ContextPack =
        packFromStore ??
        (await input.contextPackService.buildContextPack(project.ownerUserId, run.projectId, {
          featureId: run.featureId,
          type: "coding",
          createdByJobId: jobId,
        }));

      if (!run.contextPackId) {
        await this.updateRunState(sandboxRunId, { contextPackId: pack.id });
      }

      await input.contextPackService.buildRepoFingerprint(
        project.ownerUserId,
        run.projectId,
        jobId,
      );

      if (run.kind === "verify" && options.workspaceDir) {
        await this.appendEvent(
          sandboxRunId,
          "info",
          "workspace_reuse",
          "Reused the implementation workspace for verification.",
        );
      } else if (run.kind === "verify") {
        const warmStart = run.featureId
          ? await input.db.query.sandboxRunsTable.findFirst({
              where: and(
                eq(sandboxRunsTable.featureId, run.featureId),
                eq(sandboxRunsTable.kind, "implement"),
                eq(sandboxRunsTable.status, "succeeded"),
              ),
              orderBy: [desc(sandboxRunsTable.completedAt)],
            })
          : null;

        if (warmStart?.workspaceArchivePath) {
          await input.artifactStorageService.restoreWorkspaceSnapshot(
            warmStart.workspaceArchivePath,
            workspaceDir,
          );
          await this.appendEvent(
            sandboxRunId,
            "info",
            "workspace_restore",
            "Restored warm-start workspace from previous implementation run.",
          );
        } else {
          await this.cloneRepository(
            repo.repoUrl,
            deliveryBranchPlan?.cloneBranchName ?? defaultBranchName,
            secretEnv.GITHUB_PAT,
            workspaceDir,
          );
        }
      } else {
        await this.cloneRepository(
          repo.repoUrl,
          run.branchName ?? deliveryBranchPlan?.cloneBranchName ?? defaultBranchName,
          secretEnv.GITHUB_PAT,
          workspaceDir,
        );
      }

      const currentBranchName =
        (await this.git(["branch", "--show-current"], workspaceDir).catch(() => "")) ||
        deliveryBranchPlan?.cloneBranchName ||
        defaultBranchName;
      await this.ensureManagedGitignore(workspaceDir);
      await this.writeQuayboardDocs(run.projectId, workspaceDir);
      const baseCommitSha = await this.git(["rev-parse", "HEAD"], workspaceDir).catch(() => null);
      await this.updateRunState(sandboxRunId, { baseCommitSha });

      const tasks = run.taskPlanningSessionId
        ? await input.taskPlanningService.getTasks(project.ownerUserId, run.taskPlanningSessionId)
        : [];
      const llmDefinition = await this.getEffectiveLlmDefinition(project.ownerUserId, run.projectId);
      const networkMode = determineNetworkModeForModel(
        llmDefinition.provider,
        llmDefinition.baseUrl,
        sandboxConfig.egressPolicy,
      );
      const sandboxModelBaseUrl = normalizeModelBaseUrl(
        llmDefinition.provider,
        llmDefinition.baseUrl,
        networkMode,
      );
      await writeFile(path.join(workspaceDir, ".quayboard-context.md"), pack.content);
      const taskFileContent =
        run.kind === "project_review"
          ? [
              "Produce a project-wide engineering due diligence review for this repository.",
              "Inspect the actual repository contents before making claims.",
              "Write the human-readable report to /root/.local/share/opencode/tool-output/project-review.md.",
              "Write the structured output to /root/.local/share/opencode/tool-output/project-review.json.",
              "Do not make repository changes during the review run.",
            ].join("\n")
          : run.kind === "project_fix"
            ? [
                "Read /workspace/.quayboard-project-review.md for the latest project review.",
                "Read /workspace/.quayboard-project-review-findings.json for the normalized findings to fix.",
                "Address only the cited findings in one batched remediation pass.",
                "Re-run relevant checks before exiting.",
                "Write a remediation summary to /root/.local/share/opencode/tool-output/project-fix-summary.md.",
              ].join("\n")
            : tasks
                .map(
                  (task, index) =>
                    `${index + 1}. ${task.title}\n${task.description}\n${task.acceptanceCriteria.join("\n")}`,
                )
                .join("\n\n");
      await writeFile(path.join(workspaceDir, ".quayboard-tasks.md"), taskFileContent);
      if (run.kind === "project_fix") {
        const latestReviewArtifact = await this.getLatestProjectReviewArtifacts(run.projectId);
        await writeFile(
          path.join(workspaceDir, ".quayboard-project-review.md"),
          latestReviewArtifact.markdown,
        );
        await writeFile(
          path.join(workspaceDir, ".quayboard-project-review-findings.json"),
          latestReviewArtifact.findingsJson,
        );
      }
      if (run.kind === "ci_repair" && run.milestoneId) {
        await writeFile(
          path.join(workspaceDir, ".quayboard-ci-failure.md"),
          await this.buildMilestoneCiFailureDocument(
            project.ownerUserId,
            run.projectId,
            run.milestoneId,
          ),
        );
      }

      await input.dockerService.ensureImage(
        executionSettings.defaultImage,
        executionSettings.dockerHost,
      );

      const containerId = await input.dockerService.createManagedContainer({
        artifactDir,
        command: [],
        cpuLimit: sandboxConfig.cpuLimit,
        dockerHost: executionSettings.dockerHost,
        env: {
          ...secretEnv,
          QB_CONTEXT_PATH: "/workspace/.quayboard-context.md",
          QB_LLM_API_KEY: llmDefinition.apiKey ?? "",
          QB_LLM_BASE_URL: sandboxModelBaseUrl,
          QB_LLM_MODEL: llmDefinition.model,
          QB_LLM_PROVIDER: llmDefinition.provider,
          QB_TASKS_PATH: "/workspace/.quayboard-tasks.md",
          QB_RUN_KIND: run.kind,
        },
        image: executionSettings.defaultImage,
        labels: {
          "quayboard.project_id": run.projectId,
          "quayboard.sandbox_run_id": run.id,
        },
        memoryMb: sandboxConfig.memoryMb,
        name: `qb-${run.id.slice(0, 8)}`,
        networkDisabled: networkMode === "none",
        networkMode,
        workspaceDir,
      });

      await this.updateRunState(sandboxRunId, { containerId });
      await this.appendEvent(sandboxRunId, "info", "container_created", "Sandbox container created.", {
        containerId,
      });

      let outputsCaptured = false;
      const captureRunOutputs = async () => {
        if (outputsCaptured) {
          return;
        }

        outputsCaptured = true;

        const logs = await input.dockerService.readLogs(
          containerId,
          executionSettings.dockerHost,
        ).catch(() => "");
        const storedLog = await input.artifactStorageService.writeRunArtifact(
          sandboxRunId,
          "container.log",
          logs,
          "text/plain",
        );
        await this.attachArtifact(
          sandboxRunId,
          "container.log",
          storedLog.contentType,
          storedLog.path,
          storedLog.sizeBytes,
        );

        await this.captureArtifactsFromDir(sandboxRunId, artifactDir).catch(() => undefined);
        await this.captureGitArtifacts(sandboxRunId, workspaceDir).catch(() => undefined);
      };

      await input.dockerService.startContainer(
        containerId,
        executionSettings.dockerHost,
      );
      let exitCode: number;
      try {
        exitCode = await input.dockerService.waitForContainer(
          containerId,
          executionSettings.dockerHost,
          sandboxConfig.timeoutSeconds * 1000,
        );
      } catch (error) {
        if (isDockerWaitTimeoutError(error)) {
          await input.dockerService.stopContainer(
            containerId,
            executionSettings.dockerHost,
          ).catch(() => undefined);
          await captureRunOutputs();

          const timeoutMinutes = Math.round(error.timeoutMs / 60_000);
          const timeoutMessage =
            `${run.kind} run did not exit within ${timeoutMinutes} minutes. ` +
            "This usually means a long-lived background process was left running.";

          await this.updateRunState(sandboxRunId, {
            status: "failed",
            outcome: run.kind === "verify" ? "verification_failed" : "error",
            completedAt: new Date(),
          });
          runFinalized = true;
          await this.appendEvent(
            sandboxRunId,
            "error",
            "run_failed",
            timeoutMessage,
          );
          throw createHandledRunFailure(timeoutMessage);
        }

        throw error;
      }

      await captureRunOutputs();

      const headCommitSha = await this.git(["rev-parse", "HEAD"], workspaceDir).catch(
        () => baseCommitSha,
      );
      await this.updateRunState(sandboxRunId, { headCommitSha });

      if (run.kind === "implement" && exitCode === 0) {
        const snapshotPath = await input.artifactStorageService.snapshotWorkspace(
          sandboxRunId,
          workspaceDir,
        );
        await this.updateRunState(sandboxRunId, {
          workspaceArchivePath: snapshotPath,
          status: "succeeded",
          outcome: (await this.hasWorkingTreeChanges(workspaceDir))
            ? "changes_applied"
            : "no_op",
          completedAt: new Date(),
        });
        runFinalized = true;
        await this.appendEvent(
          sandboxRunId,
          "info",
          "implemented",
          "Implementation run finished successfully.",
        );

        const verifyRun = await this.createRun(
          project.ownerUserId,
          run.projectId,
          {
            featureId: run.featureId!,
            kind: "verify",
          },
          jobId,
        );
        cleanupWorkspaceRootOnExit = false;
        await this.executeRun(jobId, verifyRun.id, {
          cleanupWorkspaceRootOnExit: true,
          workspaceDir,
          workspaceRoot,
        });
        return;
      }

      if (run.kind === "ci_repair" && exitCode === 0) {
        const publishResult = await this.publishPullRequestIfNeeded(
          workspaceDir,
          repo,
          secretEnv.GITHUB_PAT,
          `Repair milestone CI failures`,
          sandboxRunId,
          deliveryBranchPlan ??
            ({
              baseBranchName: defaultBranchName,
              cloneBranchName: currentBranchName,
              targetBranchName: currentBranchName,
              pullRequestTitle: `Repair milestone CI`,
              pullRequestBody: `Automated CI repair run ${sandboxRunId}.`,
            } satisfies DeliveryBranchPlan),
          baseCommitSha,
        );
        await this.updateRunState(sandboxRunId, {
          status: "succeeded",
          outcome: publishResult.commitSha ? "changes_applied" : "no_op",
          headCommitSha: publishResult.commitSha ?? headCommitSha,
          pullRequestUrl: publishResult.pullRequestUrl,
          completedAt: new Date(),
        });
        runFinalized = true;
        await this.appendEvent(
          sandboxRunId,
          "info",
          "ci_repaired",
          publishResult.pullRequestUrl
            ? "CI repair completed and updated the milestone pull request."
            : "CI repair completed with no new pull request update required.",
        );
        return;
      }

      if (run.kind === "project_fix" && exitCode === 0) {
        const publishResult = await this.publishPullRequestIfNeeded(
          workspaceDir,
          repo,
          secretEnv.GITHUB_PAT,
          "Project review remediation",
          sandboxRunId,
          deliveryBranchPlan ??
            ({
              baseBranchName: defaultBranchName,
              cloneBranchName: currentBranchName,
              targetBranchName: run.branchName ?? projectReviewFixBranchName,
              pullRequestTitle: "Project review remediation",
              pullRequestBody: `Automated project review remediation run ${sandboxRunId}.`,
            } satisfies DeliveryBranchPlan),
          baseCommitSha,
        );
        await this.updateRunState(sandboxRunId, {
          status: "succeeded",
          outcome: publishResult.commitSha ? "changes_applied" : "no_op",
          headCommitSha: publishResult.commitSha ?? headCommitSha,
          pullRequestUrl: publishResult.pullRequestUrl,
          branchName: run.branchName ?? projectReviewFixBranchName,
          completedAt: new Date(),
        });
        runFinalized = true;
        await this.appendEvent(
          sandboxRunId,
          "info",
          "project_fix_completed",
          publishResult.pullRequestUrl
            ? "Project review remediation completed and updated the pull request."
            : "Project review remediation completed.",
        );
        return;
      }

      if ((run.kind === "verify" || run.kind === "project_review") && exitCode === 0) {
        const [feature, headRevision] =
          run.kind === "verify"
            ? await Promise.all([
                input.db.query.featureCasesTable.findFirst({
                  where: eq(featureCasesTable.id, run.featureId!),
                }),
                input.db.query.featureRevisionsTable.findFirst({
                  where: eq(featureRevisionsTable.featureId, run.featureId!),
                  orderBy: [desc(featureRevisionsTable.version)],
                }),
              ])
            : [null, null];
        const publishResult = run.kind === "verify"
          ? await this.publishPullRequestIfNeeded(
          workspaceDir,
          repo,
          secretEnv.GITHUB_PAT,
          feature && headRevision
            ? `Implement ${feature.featureKey}: ${headRevision.title}`
            : `Implement ${run.featureId!}`,
          sandboxRunId,
          deliveryBranchPlan ??
            ({
              baseBranchName: defaultBranchName,
              cloneBranchName: currentBranchName,
              targetBranchName: currentBranchName,
              pullRequestTitle: `Implement ${run.featureId!}`,
              pullRequestBody: `Automated sandbox verification run ${sandboxRunId}.`,
            } satisfies DeliveryBranchPlan),
          baseCommitSha,
        )
          : { bootstrappedDefaultBranch: false, commitSha: headCommitSha, pullRequestUrl: null };
        const approvedTechRevision = run.kind === "verify" ? await input.db.query.featureTechRevisionsTable.findFirst({
          where: eq(featureTechRevisionsTable.featureId, run.featureId!),
          orderBy: [desc(featureTechRevisionsTable.version)],
        }) : null;
        if (run.kind === "verify" && approvedTechRevision) {
          await input.taskPlanningService.createImplementationRecord(
            project.ownerUserId,
            run.featureId!,
            approvedTechRevision.id,
            publishResult.commitSha ?? headCommitSha,
            sandboxRunId,
          );
        }
        if (run.kind === "verify" && run.taskPlanningSessionId) {
          await input.db
            .update(featureDeliveryTasksTable)
            .set({
              status: "completed",
              updatedAt: new Date(),
            })
            .where(eq(featureDeliveryTasksTable.sessionId, run.taskPlanningSessionId));
        }
        await this.updateRunState(sandboxRunId, {
          status: "succeeded",
          outcome: run.kind === "verify" ? "verification_passed" : "no_op",
          headCommitSha: publishResult.commitSha ?? headCommitSha,
          pullRequestUrl: publishResult.pullRequestUrl,
          branchName: run.branchName ?? null,
          completedAt: new Date(),
        });
        runFinalized = true;
        await this.appendEvent(
          sandboxRunId,
          "info",
          run.kind === "verify" ? "verified" : "project_review_completed",
          run.kind === "verify"
            ? publishResult.pullRequestUrl
              ? "Verification completed and pull request created."
              : publishResult.bootstrappedDefaultBranch
                ? "Verification completed and pushed the initial commit to the default branch."
                : "Verification completed with no pull request because the workspace was unchanged."
            : "Project review completed successfully.",
        );
        return;
      }

      await this.updateRunState(sandboxRunId, {
        status: "failed",
        outcome: run.kind === "verify" ? "verification_failed" : "error",
        completedAt: new Date(),
      });
      runFinalized = true;
      await this.appendEvent(
        sandboxRunId,
        "error",
        "run_failed",
        `${run.kind} run exited with code ${exitCode}.`,
      );
      throw createHandledRunFailure(`${run.kind} run exited with code ${exitCode}.`);
    } catch (error) {
      if (isHandledRunFailure(error) || runFinalized) {
        throw error;
      }
      const current = await input.db.query.sandboxRunsTable.findFirst({
        where: eq(sandboxRunsTable.id, sandboxRunId),
      });
      if (current?.containerId) {
        await input.dockerService.stopContainer(
          current.containerId,
          executionSettings.dockerHost,
        ).catch(() => undefined);
      }
      const sanitizedError = sanitizeGitError(error, secretsToRedact);
      const currentContainerId = current?.containerId ?? null;
      if (currentContainerId) {
        const logs = await input.dockerService.readLogs(
          currentContainerId,
          executionSettings.dockerHost,
        ).catch(() => "");
        const storedLog = await input.artifactStorageService.writeRunArtifact(
          sandboxRunId,
          "container.log",
          logs,
          "text/plain",
        );
        await this.attachArtifact(
          sandboxRunId,
          "container.log",
          storedLog.contentType,
          storedLog.path,
          storedLog.sizeBytes,
        ).catch(() => undefined);
        await this.captureArtifactsFromDir(sandboxRunId, artifactDir).catch(() => undefined);
        await this.captureGitArtifacts(sandboxRunId, workspaceDir).catch(() => undefined);
      }
      await this.updateRunState(sandboxRunId, {
        status: "failed",
        outcome: run.kind === "verify" ? "verification_failed" : "error",
        completedAt: new Date(),
      }).catch(() => undefined);
      runFinalized = true;
      await this.appendEvent(
        sandboxRunId,
        "error",
        "run_failed",
        sanitizedError.message,
      ).catch(() => undefined);
      throw sanitizedError;
    } finally {
      const current = await input.db.query.sandboxRunsTable.findFirst({
        where: eq(sandboxRunsTable.id, sandboxRunId),
      });
      if (current?.containerId) {
        await input.dockerService.stopContainer(
          current.containerId,
          executionSettingsSchema.parse(
            await input.executionSettingsService.get(),
          ).dockerHost,
        ).catch(() => undefined);
        await input.dockerService.removeContainer(current.containerId, {
          dockerHost: executionSettingsSchema.parse(
            await input.executionSettingsService.get(),
          ).dockerHost,
          force: true,
        }).catch(() => undefined);
      }
      await cleanup();
      if (run.featureId) {
        await this.pruneWorkspaceSnapshots(run.featureId).catch(() => undefined);
      }
      await input.dockerService.pruneManagedResources({
        dockerHost: executionSettings.dockerHost,
      });
    }
  },

  async cloneRepository(repoUrl: string, defaultBranch: string, token: string, targetPath: string) {
    const authenticatedRepoUrl = buildAuthenticatedRepoUrl(repoUrl, token);
    try {
      await execFileAsync(
        "git",
        [
          "clone",
          "--depth",
          "1",
          "--branch",
          defaultBranch,
          authenticatedRepoUrl,
          targetPath,
        ],
        {
          env: {
            ...process.env,
            ...gitUserEnv,
          },
        },
      );
    } catch (error) {
      if (!isMissingRemoteBranchError(error, defaultBranch)) {
        throw sanitizeGitError(error, [token]);
      }

      try {
        await execFileAsync(
          "git",
          ["clone", authenticatedRepoUrl, targetPath],
          {
            env: {
              ...process.env,
              ...gitUserEnv,
            },
          },
        );
      } catch (cloneError) {
        throw sanitizeGitError(cloneError, [token]);
      }

      const hasHeadCommit = await this.git(["rev-parse", "--verify", "HEAD"], targetPath).catch(
        () => null,
      );
      if (!hasHeadCommit) {
        await this.git(["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`], targetPath);
      }
    }
  },

  async git(args: string[], cwd: string, secrets: string[] = []) {
    let result;
    try {
      result = await execFileAsync("git", args, {
        cwd,
        env: {
          ...process.env,
          ...gitUserEnv,
        },
      });
    } catch (error) {
      throw sanitizeGitError(error, secrets);
    }

    return result.stdout.trim();
  },

  async hasWorkingTreeChanges(workspaceDir: string) {
    const status = await this.git(["status", "--porcelain"], workspaceDir);
    return status.length > 0;
  },

  async hasStagedChanges(workspaceDir: string) {
    try {
      await this.git(["diff", "--cached", "--quiet"], workspaceDir);
      return false;
    } catch {
      return true;
    }
  },

  async captureArtifactsFromDir(sandboxRunId: string, artifactDir: string) {
    const entries = await readdir(artifactDir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const stored = await input.artifactStorageService.copyRunArtifact(
        sandboxRunId,
        path.join(artifactDir, entry.name),
      );
      await this.attachArtifact(
        sandboxRunId,
        entry.name,
        stored.contentType,
        stored.path,
        stored.sizeBytes,
      );
    }
  },

  async captureGitArtifacts(sandboxRunId: string, workspaceDir: string) {
    const [status, diff, diffStat] = await Promise.all([
      this.git(["status", "--short"], workspaceDir).catch(() => ""),
      this.git(["diff"], workspaceDir).catch(() => ""),
      this.git(["diff", "--stat"], workspaceDir).catch(() => ""),
    ]);

    const artifacts = [
      { name: "git-status.txt", content: status, contentType: "text/plain" },
      { name: "git-diff.patch", content: diff, contentType: "text/x-diff" },
      { name: "git-diff-stat.txt", content: diffStat, contentType: "text/plain" },
    ];

    for (const artifact of artifacts) {
      const stored = await input.artifactStorageService.writeRunArtifact(
        sandboxRunId,
        artifact.name,
        artifact.content,
        artifact.contentType,
      );
      await this.attachArtifact(
        sandboxRunId,
        artifact.name,
        artifact.contentType,
        stored.path,
        stored.sizeBytes,
      );
    }
  },

  async ensureManagedGitignore(workspaceDir: string) {
    const gitignorePath = path.join(workspaceDir, ".gitignore");
    const existing = await readFile(gitignorePath, "utf8").catch(() => "");
    const next = replaceManagedBlock(existing, managedGitignoreEntries);

    if (next !== existing) {
      await writeFile(gitignorePath, next, "utf8");
    }
  },

  async cleanupTransientGitMessageFiles(workspaceDir: string) {
    await Promise.all(
      transientGitMessageFiles.map((fileName) =>
        rm(path.join(workspaceDir, ".git", fileName), { force: true }).catch(() => undefined),
      ),
    );
  },

  async writeQuayboardDocs(projectId: string, workspaceDir: string) {
    const [project, onePager, milestoneDocs] = await Promise.all([
      input.db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, projectId),
      }),
      input.db.query.onePagersTable.findFirst({
        where: and(eq(onePagersTable.projectId, projectId), eq(onePagersTable.isCanonical, true)),
        orderBy: [desc(onePagersTable.version)],
      }),
      input.db
        .select({
          milestoneId: milestonesTable.id,
          position: milestonesTable.position,
          title: milestonesTable.title,
          markdown: milestoneDesignDocsTable.markdown,
        })
        .from(milestoneDesignDocsTable)
        .innerJoin(milestonesTable, eq(milestonesTable.id, milestoneDesignDocsTable.milestoneId))
        .where(
          and(
            eq(milestonesTable.projectId, projectId),
            eq(milestoneDesignDocsTable.isCanonical, true),
          ),
        )
        .orderBy(asc(milestonesTable.position)),
    ]);

    const docsRoot = path.join(workspaceDir, "docs", "quayboard");
    const milestonesRoot = path.join(docsRoot, "milestones");
    await mkdir(milestonesRoot, { recursive: true });

    const overviewPath = "overview.md";
    const milestoneLines = milestoneDocs.map(
      (doc) => `- [Milestone ${doc.position}: ${doc.title}](milestones/milestone-${doc.position}.md)`,
    );
    const indexContent = [
      `# Quayboard Planning Docs`,
      "",
      `Project: ${project?.name ?? projectId}`,
      "",
      "- [Overview](overview.md)",
      ...milestoneLines,
      "",
      "These files are generated from Quayboard's canonical planning artifacts.",
      "They are intended to keep milestone delivery branches explainable inside the target repository.",
    ].join("\n");
    const overviewContent = [
      `# Project Overview`,
      "",
      onePager?.markdown ?? "No canonical project overview was available when this run executed.",
    ].join("\n");

    await writeFile(path.join(docsRoot, "README.md"), `${indexContent}\n`, "utf8");
    await writeFile(path.join(docsRoot, overviewPath), `${overviewContent}\n`, "utf8");

    await Promise.all(
      milestoneDocs.map((doc) =>
        writeFile(
          path.join(milestonesRoot, `milestone-${doc.position}.md`),
          `${doc.markdown}\n`,
          "utf8",
        ),
      ),
    );
  },

  async buildMilestoneCiFailureDocument(
    ownerUserId: string,
    projectId: string,
    milestoneId: string,
  ) {
    const milestone = await input.db.query.milestonesTable.findFirst({
      where: eq(milestonesTable.id, milestoneId),
    });
    const repo = await input.db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, projectId),
    });
    const env = await input.secretService.buildSecretEnvMap(ownerUserId, projectId);

    if (!milestone || !repo?.owner || !repo.name || !env.GITHUB_PAT) {
      return "# CI Failure Context\n\nUnable to load milestone CI failure details.\n";
    }

    const ciStatus = await input.githubService.getCommitCiStatus({
      owner: repo.owner,
      repo: repo.name,
      token: env.GITHUB_PAT,
      ref: buildMilestoneDeliveryBranchName(milestone),
    });

    const failureLines =
      ciStatus.failures.length > 0
        ? ciStatus.failures.map(
            (failure, index) =>
              `${index + 1}. ${failure.name}\nSource: ${failure.source}\nSummary: ${failure.summary ?? "n/a"}\nDetails: ${failure.detailsUrl ?? "n/a"}`,
          )
        : ["No explicit failing checks were returned by GitHub."];

    const pendingLines =
      ciStatus.checks
        .filter((check) => check.status !== "completed" && check.status !== "success")
        .map(
          (check, index) =>
            `${index + 1}. ${check.name}\nSource: ${check.source}\nStatus: ${check.status}\nWorkflow: ${check.workflowName ?? "n/a"}\nStarted: ${check.startedAt ?? "n/a"}\nLast Updated: ${check.lastUpdatedAt ?? "n/a"}\nDetails: ${check.detailsUrl ?? "n/a"}`,
        ) ?? [];

    const guidanceLines = ciStatus.isStale
      ? [
          "Pending checks have remained unchanged long enough to look stuck.",
          "Read the workflow file to identify the exact CI command.",
          "Reproduce the command locally with a timeout.",
          "If tests appear to finish but the process does not exit, treat it as an open-handle or teardown problem.",
          "Prefer the smallest fix that makes the CI command exit cleanly.",
        ]
      : [
          "Repair only the CI issue described here and re-run the closest equivalent local checks before exiting.",
        ];

    return [
      "# CI Failure Context",
      "",
      `Milestone: ${milestone.title}`,
      `Branch: ${buildMilestoneDeliveryBranchName(milestone)}`,
      `State: ${ciStatus.state}`,
      `Stale Pending Detected: ${ciStatus.isStale ? "yes" : "no"}`,
      "",
      "Pending Checks:",
      ...(pendingLines.length > 0 ? pendingLines : ["No pending checks were returned by GitHub."]),
      "",
      "Failures:",
      ...failureLines,
      "",
      "Repair Guidance:",
      ...guidanceLines,
    ].join("\n");
  },

  async removeExcludedPublishPaths(workspaceDir: string, baseCommitSha: string | null) {
    if (baseCommitSha) {
      await this.git(["reset", "HEAD", "--", ...excludedPublishPaths], workspaceDir).catch(
        () => undefined,
      );
      return;
    }

    await this.git(
      ["rm", "-r", "--cached", "--ignore-unmatch", "--", ...excludedPublishPaths],
      workspaceDir,
    ).catch(() => undefined);
  },

  async revertProtectedDeletionsIfNeeded(
    workspaceDir: string,
    sandboxRunId: string,
    baseCommitSha: string | null,
  ) {
    if (!baseCommitSha) {
      return;
    }

    const deleted = await this.git(
      ["diff", "--cached", "--diff-filter=D", "--name-only"],
      workspaceDir,
    ).catch(() => "");
    const protectedDeletions = deleted
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) =>
        protectedPublishPaths.some(
          (prefix) => entry === prefix.replace(/\/$/, "") || entry.startsWith(prefix),
        ),
      );

    if (protectedDeletions.length === 0) {
      return;
    }

    await this.git(["reset", "HEAD", "--", ...protectedDeletions], workspaceDir).catch(
      () => undefined,
    );
    await this.git(["checkout", "--", ...protectedDeletions], workspaceDir).catch(() => undefined);
    await this.appendEvent(
      sandboxRunId,
      "warning",
      "protected_deletion_reverted",
      `Reverted deletion of protected files: ${protectedDeletions.join(", ")}`,
    );
  },

  async publishPullRequestIfNeeded(
    workspaceDir: string,
    repo: typeof reposTable.$inferSelect,
    token: string,
    commitMessage: string,
    sandboxRunId: string,
    branchPlan: DeliveryBranchPlan,
    baseCommitSha: string | null,
  ): Promise<{
    bootstrappedDefaultBranch: boolean;
    branchName: string | null;
    commitSha: string | null;
    pullRequestUrl: string | null;
  }> {
    const dirty = await this.hasWorkingTreeChanges(workspaceDir);
    if (!dirty || !repo.owner || !repo.name || !repo.repoUrl) {
      return {
        bootstrappedDefaultBranch: false,
        branchName: null,
        commitSha: await this.git(["rev-parse", "HEAD"], workspaceDir).catch(() => null),
        pullRequestUrl: null,
      };
    }

    const targetBranch = baseCommitSha
      ? branchPlan.targetBranchName
      : branchPlan.baseBranchName;
    const currentBranch = await this.git(["branch", "--show-current"], workspaceDir).catch(
      () => "",
    );

    if (currentBranch !== targetBranch) {
      const localBranchExists = await this.git(
        ["rev-parse", "--verify", targetBranch],
        workspaceDir,
      )
        .then(() => true)
        .catch(() => false);

      await this.git(
        localBranchExists
          ? ["checkout", targetBranch]
          : ["checkout", baseCommitSha ? "-b" : "-B", targetBranch],
        workspaceDir,
      );
    }

    await this.git(["add", "-A"], workspaceDir);
    await this.removeExcludedPublishPaths(workspaceDir, baseCommitSha);
    await this.revertProtectedDeletionsIfNeeded(workspaceDir, sandboxRunId, baseCommitSha);
    if (!(await this.hasStagedChanges(workspaceDir))) {
      return {
        bootstrappedDefaultBranch: false,
        branchName: targetBranch,
        commitSha: await this.git(["rev-parse", "HEAD"], workspaceDir).catch(() => null),
        pullRequestUrl: null,
      };
    }
    await this.cleanupTransientGitMessageFiles(workspaceDir);
    await this.git(["commit", "-m", commitMessage], workspaceDir);
    await this.git(["push", "origin", `HEAD:${targetBranch}`], workspaceDir, [token]);
    const commitSha = await this.git(["rev-parse", "HEAD"], workspaceDir).catch(() => null);

    if (!baseCommitSha) {
      await this.updateRunState(sandboxRunId, {
        branchName: targetBranch,
        pullRequestUrl: null,
      });
      return {
        bootstrappedDefaultBranch: true,
        branchName: targetBranch,
        commitSha,
        pullRequestUrl: null,
      };
    }

    const existingPr = await input.githubService.findOpenPullRequestForHead({
      owner: repo.owner,
      repo: repo.name,
      token,
      head: targetBranch,
    });
    const pullRequestUrl =
      existingPr?.url ??
      (
        await input.githubService.createPullRequest({
          owner: repo.owner,
          repo: repo.name,
          token,
          title: branchPlan.pullRequestTitle,
          head: targetBranch,
          base: branchPlan.baseBranchName,
          body: branchPlan.pullRequestBody,
        })
      ).url;

    await this.updateRunState(sandboxRunId, {
      branchName: targetBranch,
      pullRequestUrl,
    });

    return {
      bootstrappedDefaultBranch: false,
      branchName: targetBranch,
      commitSha,
      pullRequestUrl,
    };
  },
});

export type SandboxService = ReturnType<typeof createSandboxService>;
