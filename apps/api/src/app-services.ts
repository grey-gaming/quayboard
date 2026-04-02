import { eq } from "drizzle-orm";

import { createPostgresDatabase, type AppDatabase } from "./db/client.js";
import { readAppConfig } from "./config.js";
import { projectsTable } from "./db/schema.js";
import {
  createArtifactStorageService,
  type ArtifactStorageService,
} from "./services/artifact-storage-service.js";
import {
  createArtifactApprovalService,
  type ArtifactApprovalService,
} from "./services/artifact-approval-service.js";
import { createAuthService, type AuthService } from "./services/auth-service.js";
import {
  createBlueprintService,
  type BlueprintService,
} from "./services/blueprint-service.js";
import {
  createContextPackService,
  type ContextPackService,
} from "./services/context-pack-service.js";
import { createDockerService, type DockerService } from "./services/docker-service.js";
import {
  createExecutionSettingsService,
  type ExecutionSettingsService,
} from "./services/execution-settings-service.js";
import {
  createFeatureService,
  type FeatureService,
} from "./services/feature-service.js";
import {
  createFeatureWorkstreamService,
  type FeatureWorkstreamService,
} from "./services/feature-workstream-service.js";
import { createGithubService, type GithubService } from "./services/github-service.js";
import {
  createJobRunnerService,
  type JobRunnerService,
} from "./services/jobs/job-runner-service.js";
import {
  createJobScheduler,
  type JobScheduler,
} from "./services/jobs/job-scheduler.js";
import {
  createJobService,
  type JobService,
} from "./services/jobs/job-service.js";
import {
  createLlmProviderService,
  type LlmProviderService,
} from "./services/llm-provider.js";
import {
  createMilestoneService,
  type MilestoneService,
} from "./services/milestone-service.js";
import {
  createNextActionsService,
  type NextActionsService,
} from "./services/next-actions-service.js";
import {
  createOnePagerService,
  type OnePagerService,
} from "./services/one-pager-service.js";
import {
  createProductSpecService,
  type ProductSpecService,
} from "./services/product-spec-service.js";
import {
  createPhaseGateService,
  type PhaseGateService,
} from "./services/phase-gate-service.js";
import {
  createProjectService,
  type ProjectService,
} from "./services/project-service.js";
import {
  createProjectSetupService,
  type ProjectSetupService,
} from "./services/project-setup-service.js";
import {
  createQuestionnaireService,
  type QuestionnaireService,
} from "./services/questionnaire-service.js";
import {
  createSecretService,
  type SecretService,
} from "./services/secret-service.js";
import {
  createUnavailableSecretsCrypto,
  createSecretsCrypto,
  type SecretsCrypto,
} from "./services/secrets-crypto.js";
import {
  createSettingsService,
  type SettingsService,
} from "./services/settings-service.js";
import {
  createSandboxService,
  type SandboxService,
} from "./services/sandbox-service.js";
import { createSseHub, type SseHub } from "./services/sse.js";
import {
  createSystemReadinessService,
  type SystemReadinessService,
} from "./services/system-readiness-service.js";
import {
  createUserFlowService,
  type UserFlowService,
} from "./services/user-flow-service.js";
import {
  createTaskPlanningService,
} from "./services/task-planning-service.js";
import type {
  TaskPlanningService,
} from "./services/task-planning-service.js";
import {
  createAutoAdvanceService,
  type AutoAdvanceService,
} from "./services/auto-advance.js";

export type AppServices = {
  autoAdvanceService: AutoAdvanceService;
  artifactApprovalService: ArtifactApprovalService;
  artifactStorageService: ArtifactStorageService;
  authService: AuthService;
  blueprintService: BlueprintService;
  contextPackService: ContextPackService;
  db: AppDatabase;
  dockerService: DockerService;
  executionSettingsService: ExecutionSettingsService;
  featureService: FeatureService;
  featureWorkstreamService: FeatureWorkstreamService;
  githubService: GithubService;
  jobRunnerService: JobRunnerService;
  jobScheduler: JobScheduler;
  jobService: JobService;
  llmProviderService: LlmProviderService;
  milestoneService: MilestoneService;
  nextActionsService: NextActionsService;
  onePagerService: OnePagerService;
  productSpecService: ProductSpecService;
  phaseGateService: PhaseGateService;
  projectService: ProjectService;
  projectSetupService: ProjectSetupService;
  questionnaireService: QuestionnaireService;
  sandboxService: SandboxService;
  secretService: SecretService;
  secretsCrypto: SecretsCrypto;
  settingsService: SettingsService;
  sseHub: SseHub;
  systemReadinessService: SystemReadinessService;
  taskPlanningService: TaskPlanningService;
  userFlowService: UserFlowService;
};

const staleJobCancellation = {
  code: "job_interrupted_by_server_restart",
  message: "The API restarted before this LLM job finished, so the job was cancelled.",
} as const;

const shutdownJobCancellation = {
  code: "job_interrupted_by_server_shutdown",
  message: "The API shut down before this LLM job finished, so the job was cancelled.",
} as const;

export const createAppServices = async (
  databaseUrl: string,
  secretsEncryptionKey: string | null,
) => {
  const appConfig = readAppConfig();
  const { client, db } = createPostgresDatabase(databaseUrl);
  const secretsCrypto = secretsEncryptionKey
    ? createSecretsCrypto(secretsEncryptionKey)
    : createUnavailableSecretsCrypto();
  const projectService = createProjectService(db);
  const authService = createAuthService(db);
  const secretService = createSecretService(db, secretsCrypto, projectService);
  const sseHub = createSseHub();
  const settingsService = createSettingsService(db);
  const artifactStorageService = createArtifactStorageService(appConfig.artifactStoragePath);
  const executionSettingsService = createExecutionSettingsService(settingsService, {
    defaultImage: "quayboard-agent-sandbox:latest",
    dockerHost: appConfig.dockerHost,
    maxConcurrentRuns: 2,
    defaultTimeoutSeconds: 900,
    defaultCpuLimit: 1,
    defaultMemoryMb: 2048,
  });
  const jobService = createJobService(db);
  const llmProviderService = createLlmProviderService({
    maxOutputTokens: appConfig.llmMaxOutputTokens,
    requestTimeoutMs: appConfig.llmRequestTimeoutMs,
  });
  const githubService = createGithubService();
  const dockerService = createDockerService(appConfig.dockerHost);
  const questionnaireService = createQuestionnaireService(db);
  const onePagerService = createOnePagerService(db);
  const productSpecService = createProductSpecService(db);
  const userFlowService = createUserFlowService(db);
  const blueprintService = createBlueprintService(db);
  const milestoneService = createMilestoneService(db, githubService, secretService);
  const featureService = createFeatureService(db, milestoneService);
  const featureWorkstreamService = createFeatureWorkstreamService(db, milestoneService);
  const taskPlanningService = createTaskPlanningService(
    db,
    milestoneService,
    featureWorkstreamService,
  );
  const contextPackService = createContextPackService(db);
  const artifactApprovalService = createArtifactApprovalService(
    db,
    blueprintService,
    milestoneService,
    productSpecService,
  );
  const projectSetupService = createProjectSetupService(
    db,
    projectService,
    secretService,
    settingsService,
    llmProviderService,
    githubService,
    dockerService,
    executionSettingsService,
    {
      ollamaHost: appConfig.ollamaHost,
      openAiBaseUrl: appConfig.openAiBaseUrl,
    },
  );
  const systemReadinessService = createSystemReadinessService({
    artifactStoragePath: appConfig.artifactStoragePath,
    databaseCheck: async () => {
      try {
        await client`select 1`;
        return true;
      } catch {
        return false;
      }
    },
    dockerService,
    providers: ["ollama", "openai"],
    secretsKeyPresent: Boolean(secretsEncryptionKey),
  });
  const phaseGateService = createPhaseGateService(
    artifactApprovalService,
    blueprintService,
    featureService,
    milestoneService,
    onePagerService,
    productSpecService,
    projectSetupService,
    questionnaireService,
    userFlowService,
  );
  const nextActionsService = createNextActionsService(
    artifactApprovalService,
    blueprintService,
    featureService,
    featureWorkstreamService,
    milestoneService,
    projectSetupService,
    questionnaireService,
    onePagerService,
    productSpecService,
    userFlowService,
    taskPlanningService,
  );
  const sandboxService = createSandboxService({
    artifactStorageService,
    contextPackService,
    db,
    dockerService,
    executionSettingsService,
    featureService,
    featureWorkstreamService,
    githubService,
    llmRuntimeDefaults: {
      ollamaHost: appConfig.ollamaHost,
      openAiBaseUrl: appConfig.openAiBaseUrl,
    },
    secretService,
    sseHub,
    taskPlanningService,
  });
  const autoAdvanceService = createAutoAdvanceService(
    db,
    nextActionsService,
    jobService,
    sseHub,
    artifactApprovalService,
    blueprintService,
    milestoneService,
    onePagerService,
    productSpecService,
    featureWorkstreamService,
    userFlowService,
    taskPlanningService,
    sandboxService,
  );
  const jobRunnerService = createJobRunnerService({
    artifactApprovalService,
    contextPackService,
    db,
    blueprintService,
    featureService,
    featureWorkstreamService,
    jobService,
    llmProviderService,
    milestoneService,
    onePagerService,
    productSpecService,
    projectService,
    projectSetupService,
    questionnaireService,
    sandboxService,
    userFlowService,
  });
  const jobScheduler = createJobScheduler({
    execute: async ({ job }) => {
      if (job.projectId) {
        const ownerProject = await db.query.projectsTable.findFirst({
          where: eq(projectsTable.id, job.projectId),
        });
        if (ownerProject) {
          sseHub.publish(ownerProject.ownerUserId, "job:updated", {
            jobId: job.id,
            projectId: job.projectId,
            status: job.status,
          });
        }
      }
      await jobRunnerService.run(job.id);
      const finishedJob = await jobService.getRawJob(job.id);
      if (finishedJob?.projectId) {
        const ownerProject = await db.query.projectsTable.findFirst({
          where: eq(projectsTable.id, finishedJob.projectId),
        });
        if (ownerProject) {
          sseHub.publish(ownerProject.ownerUserId, "job:updated", {
            jobId: finishedJob.id,
            projectId: finishedJob.projectId,
            status: finishedJob.status,
          });
        }
      }
      await autoAdvanceService.onJobComplete(job.id, "success").catch((err) => {
        console.error("auto-advance onJobComplete (success) failed:", err);
      });
    },
    getNextJob: () => jobService.claimNextQueuedJob(),
    onFailure: async (jobId, error) => {
      const failedJob = await jobService.markFailed(jobId, error);
      if (!failedJob.projectId) {
        return;
      }

      const ownerProject = await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, failedJob.projectId),
      });
      if (ownerProject) {
        sseHub.publish(ownerProject.ownerUserId, "job:updated", {
          jobId: failedJob.id,
          projectId: failedJob.projectId,
          status: failedJob.status,
        });
      }
      await autoAdvanceService.onJobComplete(jobId, "failure").catch((err) => {
        console.error("auto-advance onJobComplete (failure) failed:", err);
      });
    },
    maxConcurrent: 4,
  });
  await jobService.cancelRunningJobs(staleJobCancellation);

  // Recover any running auto-advance sessions left behind by an API restart.
  // Fully-settled successful batches should continue automatically; only
  // genuinely interrupted sessions should be paused.
  await autoAdvanceService.recoverRunningSessions();

  jobScheduler.start();

  return {
    services: {
    autoAdvanceService,
    artifactApprovalService,
    artifactStorageService,
    authService,
    blueprintService,
    contextPackService,
    db,
    dockerService,
    executionSettingsService,
    featureService,
    featureWorkstreamService,
    githubService,
    jobRunnerService,
    jobScheduler,
    jobService,
    llmProviderService,
    milestoneService,
    nextActionsService,
      onePagerService,
      productSpecService,
      phaseGateService,
      projectService,
      projectSetupService,
      questionnaireService,
      sandboxService,
      secretService,
      secretsCrypto,
      settingsService,
      sseHub,
      systemReadinessService,
      taskPlanningService,
      userFlowService,
    },
    async close() {
      jobScheduler.stop();
      await jobService.cancelRunningJobs(shutdownJobCancellation);
      sseHub.closeAll();
      await client.end();
    },
  };
};
