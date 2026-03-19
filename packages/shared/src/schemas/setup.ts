import { z } from "zod";

import { projectSetupStatusSchema } from "./readiness.js";

export const githubRepoOptionSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().nullable(),
  repoUrl: z.string().min(1),
});

export type GitHubRepoOption = z.infer<typeof githubRepoOptionSchema>;

export const projectSetupRepoStateSchema = z.object({
  patConfigured: z.boolean(),
  viewerLogin: z.string().nullable(),
  availableRepos: z.array(githubRepoOptionSchema),
  selectedRepo: githubRepoOptionSchema.nullable(),
});

export type ProjectSetupRepoState = z.infer<typeof projectSetupRepoStateSchema>;

export const llmProviderSchema = z.enum(["ollama", "openai"]);

export type LlmProvider = z.infer<typeof llmProviderSchema>;

export const projectSetupLlmStateSchema = z.object({
  provider: llmProviderSchema.nullable(),
  model: z.string().nullable(),
  availableModels: z.array(z.string()),
  verified: z.boolean(),
});

export type ProjectSetupLlmState = z.infer<typeof projectSetupLlmStateSchema>;

export const sandboxConfigSchema = z.object({
  allowlist: z.array(z.string()),
  cpuLimit: z.number().positive(),
  egressPolicy: z.enum(["allowlisted", "locked"]),
  memoryMb: z.number().int().positive(),
  timeoutSeconds: z.number().int().positive(),
});

export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;

export const evidencePolicySchema = z.object({
  requireArchitectureDocs: z.boolean(),
  requireUserDocs: z.boolean(),
});

export type EvidencePolicy = z.infer<typeof evidencePolicySchema>;

export const projectSetupStateSchema = z.object({
  status: projectSetupStatusSchema,
  repo: projectSetupRepoStateSchema,
  llm: projectSetupLlmStateSchema,
  sandboxConfig: sandboxConfigSchema.nullable(),
  evidencePolicy: evidencePolicySchema.nullable(),
});

export type ProjectSetupState = z.infer<typeof projectSetupStateSchema>;

export const validateGithubPatRequestSchema = z.object({
  pat: z.string().min(1),
});

export type ValidateGithubPatRequest = z.infer<typeof validateGithubPatRequestSchema>;

export const loadLlmModelsRequestSchema = z.object({
  provider: z.literal("ollama"),
});

export type LoadLlmModelsRequest = z.infer<typeof loadLlmModelsRequestSchema>;

export const loadLlmModelsResponseSchema = z.object({
  models: z.array(z.string()),
});

export type LoadLlmModelsResponse = z.infer<typeof loadLlmModelsResponseSchema>;
