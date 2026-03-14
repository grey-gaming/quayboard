import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { projectsTable, reposTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";
import type { DockerService } from "./docker-service.js";
import type { GithubService } from "./github-service.js";
import type { LlmProviderService, ProviderDefinition } from "./llm-provider.js";
import type { ProjectService } from "./project-service.js";
import type { SecretService } from "./secret-service.js";
import type { SettingsService } from "./settings-service.js";

export const PROJECT_SETTING_KEYS = {
  evidencePolicy: "project.setup.evidence_policy",
  llm: "project.setup.llm",
  sandbox: "project.setup.sandbox",
  toolPolicyPreview: "project.setup.tool_policy_preview",
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

export const createProjectSetupService = (
  db: AppDatabase,
  projectService: ProjectService,
  secretService: SecretService,
  settingsService: SettingsService,
  llmProviderService: LlmProviderService,
  githubService: GithubService,
  dockerService: DockerService,
  defaultConfig: {
    ollamaHost: string;
    openAiBaseUrl: string;
  },
) => ({
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
    await settingsService.upsertProjectSetting(projectId, PROJECT_SETTING_KEYS.llm, {
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
    sandboxConfig: {
      allowlist: string[];
      cpuLimit: number;
      egressPolicy: "allowlisted" | "locked";
      memoryMb: number;
      timeoutSeconds: number;
    },
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

  async configurePreferences(
    ownerUserId: string,
    projectId: string,
    input: {
      evidencePolicy: {
        requireArchitectureDocs: boolean;
        requireUserDocs: boolean;
      };
      toolPolicyPreview: {
        budgetCapUsd: number | null;
        enabledGroups: string[];
      };
    },
  ) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    await settingsService.upsertProjectSetting(
      projectId,
      PROJECT_SETTING_KEYS.evidencePolicy,
      input.evidencePolicy,
    );
    await settingsService.upsertProjectSetting(
      projectId,
      PROJECT_SETTING_KEYS.toolPolicyPreview,
      input.toolPolicyPreview,
    );
  },

  async verifyLlm(ownerUserId: string, projectId: string) {
    await projectService.getOwnedProject(ownerUserId, projectId);
    const llmConfig = await settingsService.getProjectSetting<LlmConfig & { verifiedAt?: string | null }>(
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

    return this.getSetupStatus(ownerUserId, projectId);
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

    const startup = await dockerService.verifySandboxImage();
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

    return this.getSetupStatus(ownerUserId, projectId);
  },

  async getSetupStatus(ownerUserId: string, projectId: string) {
    const project = await projectService.getOwnedProjectRecord(ownerUserId, projectId);
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

    if (
      repo?.verifiedAt &&
      llm?.verifiedAt &&
      sandbox?.verifiedAt &&
      project.state !== "READY_PARTIAL" &&
      project.state !== "READY"
    ) {
      await projectService.updateOwnedProject(ownerUserId, projectId, {
        state: "READY_PARTIAL",
      });
    }

    return {
      repoConnected: Boolean(repo?.verifiedAt),
      llmVerified: Boolean(llm?.verifiedAt),
      sandboxVerified: Boolean(sandbox?.verifiedAt),
      checks,
    };
  },
});

export type ProjectSetupService = ReturnType<typeof createProjectSetupService>;
