import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { reposTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { DockerService } from "./docker-service.js";
import type { ExecutionSettingsService } from "./execution-settings-service.js";
import type { GithubService } from "./github-service.js";
import type { LlmProviderService, ProviderDefinition } from "./llm-provider.js";
import type { ProjectService } from "./project-service.js";
import type { SecretService } from "./secret-service.js";
import type { SettingsService } from "./settings-service.js";

export const PROJECT_SETTING_KEYS = {
  evidencePolicy: "project.setup.evidence_policy",
  githubConnection: "project.setup.github_connection",
  llm: "project.setup.llm",
  sandbox: "project.setup.sandbox",
} as const;

type RepoConfig = {
  owner: string;
  provider: "github";
  repo: string;
};

type LlmConfig = {
  model: string;
  provider: "ollama" | "openai";
};

type EvidencePolicy = {
  requireArchitectureDocs: boolean;
  requireUserDocs: boolean;
};

type SandboxConfig = {
  allowlist: string[];
  cpuLimit: number;
  egressPolicy: "allowlisted" | "locked";
  memoryMb: number;
  timeoutSeconds: number;
};

type SandboxSetting = SandboxConfig & {
  verifiedAt?: string | null;
};

type GithubRepoOption = {
  defaultBranch: string | null;
  fullName: string;
  owner: string;
  repo: string;
  repoUrl: string;
};

type GithubConnection = {
  availableRepos: GithubRepoOption[];
  validatedAt: string;
  viewerLogin: string | null;
};

type LlmSetting = LlmConfig & {
  availableModels?: string[];
  verifiedAt?: string | null;
};

const defaultEvidencePolicy: EvidencePolicy = {
  requireArchitectureDocs: false,
  requireUserDocs: false,
};

const sandboxReadinessImage = "alpine:3.20";

const isSetupCompletedProjectState = (state: string) =>
  state === "READY_PARTIAL" || state === "READY" || state === "COMPLETED";

const hasPassingSetupChecks = (status: {
  llmVerified: boolean;
  repoConnected: boolean;
  sandboxVerified: boolean;
}) => status.repoConnected && status.llmVerified && status.sandboxVerified;

const buildSandboxConfig = (
  sandboxSetting: SandboxSetting | null,
): SandboxConfig | null => {
  if (!sandboxSetting) {
    return null;
  }

  return {
    allowlist: sandboxSetting.allowlist,
    cpuLimit: sandboxSetting.cpuLimit,
    egressPolicy: sandboxSetting.egressPolicy,
    memoryMb: sandboxSetting.memoryMb,
    timeoutSeconds: sandboxSetting.timeoutSeconds,
  };
};

const buildSelectedRepo = (
  repo: {
    defaultBranch: string | null;
    owner: string | null;
    name: string | null;
    repoUrl: string | null;
  } | null,
) => {
  if (!repo?.owner || !repo.name) {
    return null;
  }

  return {
    defaultBranch: repo.defaultBranch,
    fullName: `${repo.owner}/${repo.name}`,
    owner: repo.owner,
    repo: repo.name,
    repoUrl: repo.repoUrl ?? `https://github.com/${repo.owner}/${repo.name}`,
  };
};

export const createProjectSetupService = (
  db: AppDatabase,
  projectService: ProjectService,
  secretService: SecretService,
  settingsService: SettingsService,
  llmProviderService: LlmProviderService,
  githubService: GithubService,
  dockerService: DockerService,
  executionSettingsService: ExecutionSettingsService,
  defaultConfig: {
    ollamaHost: string;
    openAiBaseUrl: string;
  },
) => ({
  async validateGithubPat(ownerUserId: string, projectId: string, pat: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const existingSecrets = await secretService.buildSecretEnvMap(ownerUserId, projectId);
    const patChanged =
      typeof existingSecrets.GITHUB_PAT === "string" && existingSecrets.GITHUB_PAT !== pat;

    let validation;
    try {
      validation = await githubService.validatePat({ token: pat });
    } catch {
      throw new HttpError(401, "github_pat_invalid", "GitHub PAT validation failed.");
    }

    await secretService.upsertSecret(ownerUserId, projectId, {
      type: "github_pat",
      value: pat,
    });
    await settingsService.upsertProjectSetting<GithubConnection>(
      projectId,
      PROJECT_SETTING_KEYS.githubConnection,
      {
        availableRepos: validation.repositories,
        validatedAt: new Date().toISOString(),
        viewerLogin: validation.viewerLogin,
      },
    );

    if (patChanged) {
      const existingRepo = await db.query.reposTable.findFirst({
        where: eq(reposTable.projectId, projectId),
      });

      if (existingRepo?.verifiedAt) {
        await db
          .update(reposTable)
          .set({
            updatedAt: new Date(),
            verifiedAt: null,
          })
          .where(eq(reposTable.id, existingRepo.id));
      }

      await projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "BOOTSTRAPPING",
      });
    }

    return this.getSetupState(ownerUserId, projectId);
  },

  async configureRepo(ownerUserId: string, projectId: string, repoConfig: RepoConfig) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const envMap = await secretService.buildSecretEnvMap(ownerUserId, projectId);
    const token = envMap.GITHUB_PAT;

    if (!token) {
      throw new HttpError(
        409,
        "github_pat_required",
        "A GitHub PAT must be stored before verifying the repository.",
      );
    }

    const verification = await githubService.verifyRepository({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      token,
    });
    const now = new Date();
    const existing = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, projectId),
    });

    if (existing) {
      await db
        .update(reposTable)
        .set({
          provider: repoConfig.provider,
          owner: repoConfig.owner,
          name: repoConfig.repo,
          repoUrl: verification.repoUrl,
          defaultBranch: verification.defaultBranch,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(eq(reposTable.id, existing.id));
    } else {
      await db.insert(reposTable).values({
        id: generateId(),
        projectId,
        provider: repoConfig.provider,
        owner: repoConfig.owner,
        name: repoConfig.repo,
        repoUrl: verification.repoUrl,
        defaultBranch: verification.defaultBranch,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await projectService.updateOwnedProject(ownerUserId, projectId, {
      state: "BOOTSTRAPPING",
    });

    return this.getSetupStatus(ownerUserId, projectId);
  },

  async configureLlm(ownerUserId: string, projectId: string, llmConfig: LlmConfig) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const existing = await settingsService.getProjectSetting<LlmSetting>(
      projectId,
      PROJECT_SETTING_KEYS.llm,
    );

    await settingsService.upsertProjectSetting(projectId, PROJECT_SETTING_KEYS.llm, {
      availableModels:
        existing?.provider === llmConfig.provider ? existing.availableModels ?? [] : [],
      ...llmConfig,
      verifiedAt: null,
    });
    await projectService.updateOwnedProject(ownerUserId, projectId, {
      state: "BOOTSTRAPPING",
    });
  },

  async configureSandbox(
    ownerUserId: string,
    projectId: string,
    sandboxConfig: SandboxConfig,
  ) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    await settingsService.upsertProjectSetting(
      projectId,
      PROJECT_SETTING_KEYS.sandbox,
      {
        ...sandboxConfig,
        verifiedAt: null,
      },
    );
    await projectService.updateOwnedProject(ownerUserId, projectId, {
      state: "BOOTSTRAPPING",
    });
  },

  async configureEvidencePolicy(
    ownerUserId: string,
    projectId: string,
    evidencePolicy: EvidencePolicy,
  ) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    await settingsService.upsertProjectSetting(
      projectId,
      PROJECT_SETTING_KEYS.evidencePolicy,
      evidencePolicy,
    );
  },

  async verifyLlm(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const llmConfig = await settingsService.getProjectSetting<LlmSetting>(
      projectId,
      PROJECT_SETTING_KEYS.llm,
    );

    if (!llmConfig) {
      throw new HttpError(409, "llm_not_configured", "LLM settings are incomplete.");
    }

    const envMap = await secretService.buildSecretEnvMap(ownerUserId, projectId);
    const definition = this.buildProviderDefinition(llmConfig, envMap.LLM_API_KEY ?? null);
    const result = await llmProviderService.checkHealth(definition);

    if (!result.ok) {
      throw new HttpError(503, "llm_unavailable", result.message);
    }

    await settingsService.upsertProjectSetting(projectId, PROJECT_SETTING_KEYS.llm, {
      ...llmConfig,
      availableModels: result.models,
      verifiedAt: new Date().toISOString(),
    });

    const status = await this.getSetupStatus(ownerUserId, projectId);
    return { ...status, llmVerified: true };
  },

  async loadLlmModels(ownerUserId: string, projectId: string, provider: "ollama") {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const result = await llmProviderService.checkHealth({
      apiKey: null,
      baseUrl: defaultConfig.ollamaHost,
      model: "",
      provider,
    });

    if (!result.ok) {
      throw new HttpError(503, "llm_unavailable", result.message);
    }

    return {
      models: result.models,
    };
  },

  buildProviderDefinition(
    llmConfig: LlmConfig,
    apiKey: string | null,
  ): ProviderDefinition {
    return llmConfig.provider === "ollama"
      ? {
          provider: "ollama",
          model: llmConfig.model,
          baseUrl: defaultConfig.ollamaHost,
          apiKey: null,
        }
      : {
          provider: "openai",
          model: llmConfig.model,
          baseUrl: defaultConfig.openAiBaseUrl,
          apiKey,
        };
  },

  async getLlmDefinition(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const llmConfig = await settingsService.getProjectSetting<LlmConfig>(
      projectId,
      PROJECT_SETTING_KEYS.llm,
    );

    if (!llmConfig) {
      throw new HttpError(409, "llm_not_configured", "LLM settings are incomplete.");
    }

    const envMap = await secretService.buildSecretEnvMap(ownerUserId, projectId);

    return this.buildProviderDefinition(llmConfig, envMap.LLM_API_KEY ?? null);
  },

  async verifySandbox(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const sandboxConfig = await settingsService.getProjectSetting<Record<string, unknown>>(
      projectId,
      PROJECT_SETTING_KEYS.sandbox,
    );

    if (!sandboxConfig) {
      throw new HttpError(
        409,
        "sandbox_not_configured",
        "Sandbox settings are incomplete.",
      );
    }

    const availability = await dockerService.checkAvailability();
    if (!availability.ok) {
      throw new HttpError(503, "docker_unavailable", availability.message);
    }

    const executionSettings = await executionSettingsService.get();
    const startup = await dockerService.verifySandboxImage(
      sandboxReadinessImage,
      executionSettings.dockerHost,
    );
    if (!startup.ok) {
      throw new HttpError(503, "sandbox_verification_failed", startup.message);
    }

    await settingsService.upsertProjectSetting(
      projectId,
      PROJECT_SETTING_KEYS.sandbox,
      {
        ...sandboxConfig,
        verifiedAt: new Date().toISOString(),
      },
    );

    const status = await this.getSetupStatus(ownerUserId, projectId);
    return { ...status, sandboxVerified: true };
  },

  async completeSetup(ownerUserId: string, projectId: string) {
    const project = await projectService.getOwnedProject(ownerUserId, projectId);

    if (isSetupCompletedProjectState(project.state)) {
      return project;
    }

    const status = await this.getSetupStatus(ownerUserId, projectId);

    if (!hasPassingSetupChecks(status)) {
      throw new HttpError(
        409,
        "setup_incomplete",
        "Verify the repository, LLM, and sandbox before completing setup.",
      );
    }

    return projectService.updateOwnedProject(ownerUserId, projectId, {
      state: "READY_PARTIAL",
    });
  },

  async isSetupCompleted(ownerUserId: string, projectId: string) {
    const project = await projectService.getOwnedProject(ownerUserId, projectId);

    return isSetupCompletedProjectState(project.state);
  },

  async assertSetupCompleted(ownerUserId: string, projectId: string) {
    const project = await projectService.getOwnedProject(ownerUserId, projectId);

    if (isSetupCompletedProjectState(project.state)) {
      return project;
    }

    throw new HttpError(
      409,
      "setup_incomplete",
      "Complete project setup before accessing overview and user-flow planning.",
    );
  },

  async getSetupStatus(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const repo = await db.query.reposTable.findFirst({
      where: eq(reposTable.projectId, projectId),
    });
    const llm = await settingsService.getProjectSetting<{ verifiedAt?: string | null }>(
      projectId,
      PROJECT_SETTING_KEYS.llm,
    );
    const sandbox = await settingsService.getProjectSetting<{ verifiedAt?: string | null }>(
      projectId,
      PROJECT_SETTING_KEYS.sandbox,
    );

    const checks = [
      {
        key: "repo",
        label: "Repository",
        status: repo?.verifiedAt ? "pass" : "fail",
        message: repo?.verifiedAt
          ? "Repository access verified."
          : "Connect and verify a repository.",
      },
      {
        key: "llm",
        label: "LLM Provider",
        status: llm?.verifiedAt ? "pass" : "fail",
        message: llm?.verifiedAt
          ? "LLM provider verified."
          : "Configure a provider and verify connectivity.",
      },
      {
        key: "sandbox",
        label: "Sandbox",
        status: sandbox?.verifiedAt ? "pass" : "fail",
        message: sandbox?.verifiedAt
          ? "Sandbox startup verified."
          : "Configure sandbox defaults and verify startup.",
      },
    ];

    return {
      repoConnected: Boolean(repo?.verifiedAt),
      llmVerified: Boolean(llm?.verifiedAt),
      sandboxVerified: Boolean(sandbox?.verifiedAt),
      checks,
    };
  },

  async getSetupState(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const [status, repo, llm, sandboxConfig, evidencePolicy, githubConnection] =
      await Promise.all([
        this.getSetupStatus(ownerUserId, projectId),
        db.query.reposTable.findFirst({
          where: eq(reposTable.projectId, projectId),
        }),
        settingsService.getProjectSetting<LlmSetting>(projectId, PROJECT_SETTING_KEYS.llm),
        settingsService.getProjectSetting<SandboxSetting>(
          projectId,
          PROJECT_SETTING_KEYS.sandbox,
        ),
        settingsService.getProjectSetting<EvidencePolicy>(
          projectId,
          PROJECT_SETTING_KEYS.evidencePolicy,
        ),
        settingsService.getProjectSetting<GithubConnection>(
          projectId,
          PROJECT_SETTING_KEYS.githubConnection,
        ),
      ]);
    const secrets = await secretService.listSecrets(ownerUserId, projectId);

    return {
      status,
      repo: {
        patConfigured: secrets.some((secret) => secret.type === "github_pat"),
        viewerLogin: githubConnection?.viewerLogin ?? null,
        availableRepos: githubConnection?.availableRepos ?? [],
        selectedRepo: buildSelectedRepo(repo ?? null),
      },
      llm: {
        provider: llm?.provider ?? null,
        model: llm?.model ?? null,
        availableModels: llm?.availableModels ?? [],
        verified: Boolean(llm?.verifiedAt),
      },
      sandboxConfig: buildSandboxConfig(sandboxConfig),
      evidencePolicy: evidencePolicy ?? defaultEvidencePolicy,
    };
  },
});

export type ProjectSetupService = ReturnType<typeof createProjectSetupService>;
