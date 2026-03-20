import { eq } from "drizzle-orm";

import { createPostgresDatabase, type AppDatabase } from "./db/client.js";
import { readAppConfig } from "./config.js";
import { projectsTable } from "./db/schema.js";
import {
  createArtifactApprovalService,
  type ArtifactApprovalService,
} from "./services/artifact-approval-service.js";
import { createAuthService, type AuthService } from "./services/auth-service.js";
import {
  createBlueprintService,
  type BlueprintService,
} from "./services/blueprint-service.js";
import { createDockerService, type DockerService } from "./services/docker-service.js";
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
import { createSseHub, type SseHub } from "./services/sse.js";
import {
  createSystemReadinessService,
  type SystemReadinessService,
} from "./services/system-readiness-service.js";
import {
  createUserFlowService,
  type UserFlowService,
} from "./services/user-flow-service.js";

export type AppServices = {
  artifactApprovalService: ArtifactApprovalService;
  authService: AuthService;
  blueprintService: BlueprintService;
  db: AppDatabase;
  dockerService: DockerService;
  githubService: GithubService;
  jobRunnerService: JobRunnerService;
  jobScheduler: JobScheduler;
  jobService: JobService;
  llmProviderService: LlmProviderService;
  nextActionsService: NextActionsService;
  onePagerService: OnePagerService;
  productSpecService: ProductSpecService;
  phaseGateService: PhaseGateService;
  projectService: ProjectService;
  projectSetupService: ProjectSetupService;
  questionnaireService: QuestionnaireService;
  secretService: SecretService;
  secretsCrypto: SecretsCrypto;
  settingsService: SettingsService;
  sseHub: SseHub;
  systemReadinessService: SystemReadinessService;
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
  const artifactApprovalService = createArtifactApprovalService(
    db,
    blueprintService,
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
    onePagerService,
    productSpecService,
    projectSetupService,
    questionnaireService,
    userFlowService,
  );
  const nextActionsService = createNextActionsService(
    artifactApprovalService,
    blueprintService,
    projectSetupService,
    questionnaireService,
    onePagerService,
    productSpecService,
    userFlowService,
  );
  const jobRunnerService = createJobRunnerService({
    artifactApprovalService,
    db,
    blueprintService,
    jobService,
    llmProviderService,
    onePagerService,
    productSpecService,
    projectService,
    projectSetupService,
    questionnaireService,
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
    },
  });
  await jobService.cancelRunningJobs(staleJobCancellation);
  jobScheduler.start();

  return {
    services: {
      artifactApprovalService,
      authService,
      blueprintService,
      db,
      dockerService,
      githubService,
      jobRunnerService,
      jobScheduler,
      jobService,
      llmProviderService,
      nextActionsService,
      onePagerService,
      productSpecService,
      phaseGateService,
      projectService,
      projectSetupService,
      questionnaireService,
      secretService,
      secretsCrypto,
      settingsService,
      sseHub,
      systemReadinessService,
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
