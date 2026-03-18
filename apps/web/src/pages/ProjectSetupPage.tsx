import type { ProjectSetupState } from "@quayboard/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useLoadLlmModelsMutation,
  useProjectQuery,
  useProjectSetupQuery,
  useUpdateProjectMutation,
  useValidateGithubPatMutation,
  useVerifyLlmMutation,
  useVerifySandboxMutation,
} from "../hooks/use-projects.js";

type UpdateProjectPayload = Parameters<
  ReturnType<typeof useUpdateProjectMutation>["mutateAsync"]
>[0];

type FormValues = {
  cpuLimit: string;
  egressPolicy: "allowlisted" | "locked";
  githubPat: string;
  githubRepo: string;
  llmModel: string;
  llmProvider: "" | "ollama" | "openai";
  memoryMb: string;
  requireArchitectureDocs: string;
  requireUserDocs: string;
  sandboxAllowlist: string;
  timeoutSeconds: string;
};

const defaultFormValues: FormValues = {
  cpuLimit: "1",
  egressPolicy: "locked",
  githubPat: "",
  githubRepo: "",
  llmModel: "",
  llmProvider: "",
  memoryMb: "1024",
  requireArchitectureDocs: "false",
  requireUserDocs: "false",
  sandboxAllowlist: "",
  timeoutSeconds: "300",
};

const buildRepoOptions = (setupState: ProjectSetupState | undefined) => {
  const availableRepos = setupState?.repo.availableRepos ?? [];
  const selectedRepo = setupState?.repo.selectedRepo;

  if (!selectedRepo) {
    return availableRepos;
  }

  return availableRepos.some((repo) => repo.fullName === selectedRepo.fullName)
    ? availableRepos
    : [selectedRepo, ...availableRepos];
};

const buildSandboxConfig = (values: FormValues): NonNullable<UpdateProjectPayload["sandboxConfig"]> => ({
  allowlist: values.sandboxAllowlist
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  cpuLimit: Number(values.cpuLimit),
  egressPolicy: values.egressPolicy,
  memoryMb: Number(values.memoryMb),
  timeoutSeconds: Number(values.timeoutSeconds),
});

const buildEvidencePolicy = (
  values: FormValues,
): NonNullable<UpdateProjectPayload["evidencePolicy"]> => ({
  requireArchitectureDocs: values.requireArchitectureDocs === "true",
  requireUserDocs: values.requireUserDocs === "true",
});

const DocLink = ({ to, children }: { to: string; children: string }) => (
  <Link className="text-sm font-medium text-accent transition hover:text-foreground" to={to}>
    {children}
  </Link>
);

const SectionHeader = ({
  title,
  summary,
  docs,
  badge,
}: {
  title: string;
  summary: string;
  docs: { label: string; to: string }[];
  badge?: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-4">
    <div className="grid gap-2">
      <div>
        <p className="qb-meta-label">{title}</p>
        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{title}</p>
      </div>
      <p className="max-w-3xl text-sm text-secondary">{summary}</p>
      <div className="flex flex-wrap gap-3">
        {docs.map((doc) => (
          <DocLink key={doc.to} to={doc.to}>
            {doc.label}
          </DocLink>
        ))}
      </div>
    </div>
    {badge}
  </div>
);

export const ProjectSetupPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const setupQuery = useProjectSetupQuery(id);
  const updateProjectMutation = useUpdateProjectMutation(id);
  const validateGithubPatMutation = useValidateGithubPatMutation(id);
  const loadLlmModelsMutation = useLoadLlmModelsMutation(id);
  const verifyLlmMutation = useVerifyLlmMutation(id);
  const verifySandboxMutation = useVerifySandboxMutation(id);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const setupState = setupQuery.data;
  const setupStatus = setupState?.status;
  const readinessComplete = Boolean(
    setupStatus?.repoConnected && setupStatus.llmVerified && setupStatus.sandboxVerified,
  );
  const repoOptions = buildRepoOptions(setupState);
  const { getValues, register, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: defaultFormValues,
  });
  const githubPat = watch("githubPat");
  const githubRepo = watch("githubRepo");
  const llmModel = watch("llmModel");
  const llmProvider = watch("llmProvider");
  const requireArchitectureDocs = watch("requireArchitectureDocs");
  const requireUserDocs = watch("requireUserDocs");

  useEffect(() => {
    if (!setupQuery.data) {
      return;
    }

    reset({
      cpuLimit: String(setupQuery.data.sandboxConfig?.cpuLimit ?? 1),
      egressPolicy: setupQuery.data.sandboxConfig?.egressPolicy ?? "locked",
      githubPat: "",
      githubRepo: setupQuery.data.repo.selectedRepo?.fullName ?? "",
      llmModel: setupQuery.data.llm.model ?? "",
      llmProvider: setupQuery.data.llm.provider ?? "",
      memoryMb: String(setupQuery.data.sandboxConfig?.memoryMb ?? 1024),
      requireArchitectureDocs: String(
        setupQuery.data.evidencePolicy?.requireArchitectureDocs ?? false,
      ),
      requireUserDocs: String(setupQuery.data.evidencePolicy?.requireUserDocs ?? false),
      sandboxAllowlist: setupQuery.data.sandboxConfig?.allowlist.join(", ") ?? "",
      timeoutSeconds: String(setupQuery.data.sandboxConfig?.timeoutSeconds ?? 300),
    });
    setOllamaModels(
      setupQuery.data.llm.provider === "ollama" ? setupQuery.data.llm.availableModels : [],
    );
  }, [reset, setupQuery.data]);

  const activeError =
    setupQuery.error ||
    updateProjectMutation.error ||
    validateGithubPatMutation.error ||
    loadLlmModelsMutation.error ||
    verifyLlmMutation.error ||
    verifySandboxMutation.error;

  const loadOllamaModels = async () => {
    const response = await loadLlmModelsMutation.mutateAsync({ provider: "ollama" });
    setOllamaModels(response.models);
    return response.models;
  };

  const saveSelectedRepo = async () => {
    const selectedRepo = repoOptions.find((repo) => repo.fullName === getValues("githubRepo"));

    if (!selectedRepo) {
      return;
    }

    await updateProjectMutation.mutateAsync({
      repoConfig: {
        owner: selectedRepo.owner,
        provider: "github",
        repo: selectedRepo.repo,
      },
    });
  };

  const saveOpenAiLlm = async () => {
    const values = getValues();

    if (values.llmProvider !== "openai" || !values.llmModel.trim()) {
      return;
    }

    await updateProjectMutation.mutateAsync({
      llmConfig: {
        model: values.llmModel.trim(),
        provider: "openai",
      },
    });
  };

  const saveSandbox = async () => {
    await updateProjectMutation.mutateAsync({
      sandboxConfig: buildSandboxConfig(getValues()),
    });
  };

  const saveEvidencePolicy = async () => {
    await updateProjectMutation.mutateAsync({
      evidencePolicy: buildEvidencePolicy(getValues()),
    });
  };

  const repoSaved =
    Boolean(githubRepo) && setupState?.repo.selectedRepo?.fullName === githubRepo;
  const llmSaved =
    Boolean(llmProvider && llmModel.trim()) &&
    setupState?.llm.provider === llmProvider &&
    setupState.llm.model === llmModel.trim();
  const sandboxSaved = Boolean(setupState?.sandboxConfig);
  const evidenceSaved =
    setupState?.evidencePolicy?.requireArchitectureDocs ===
      (requireArchitectureDocs === "true") &&
    setupState?.evidencePolicy?.requireUserDocs === (requireUserDocs === "true");

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectContextHeader project={projectQuery.data} setupStatus={setupStatus} />
      ) : null}
      <PageIntro
        eyebrow="Project"
        title="Project Setup"
        summary="Connect the repository, configure the project-scoped LLM, define sandbox defaults, and save the documentation requirements for this project."
        meta={
          <>
            <Badge tone="neutral">project-scoped setup</Badge>
            <Badge tone={readinessComplete ? "success" : "warning"}>
              {readinessComplete ? "ready" : "in progress"}
            </Badge>
          </>
        }
      />

      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}

      <div className="grid gap-4">
        <Card surface="panel">
          <SectionHeader
            title="Repository Access"
            summary="Store a GitHub PAT for this project, load the repositories it can access, then save the exact repository Quayboard should use."
            docs={[
              { label: "Planning workflow", to: "/docs/planning-workflow" },
            ]}
            badge={
              setupStatus?.repoConnected ? (
                <Badge tone="success">verified</Badge>
              ) : repoSaved ? (
                <Badge tone="neutral">saved</Badge>
              ) : null
            }
          />
          <div className="mt-4 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="github-pat">GitHub PAT</Label>
              <Input id="github-pat" type="password" {...register("githubPat")} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={validateGithubPatMutation.isPending || !githubPat.trim()}
                  onClick={() => {
                    const pat = getValues("githubPat").trim();

                    if (!pat) {
                      return;
                    }

                    void validateGithubPatMutation.mutateAsync({ pat }).then(() => {
                      setValue("githubPat", "");
                    });
                  }}
                  type="button"
                  variant="secondary"
                >
                  {setupState?.repo.patConfigured ? "Refresh Repositories" : "Validate PAT"}
                </Button>
                {setupState?.repo.patConfigured ? <Badge tone="success">PAT saved</Badge> : null}
                {setupState?.repo.viewerLogin ? (
                  <p className="text-sm text-secondary">
                    Connected as {setupState.repo.viewerLogin}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-repo">GitHub repo</Label>
              <Select
                id="github-repo"
                disabled={repoOptions.length === 0}
                {...register("githubRepo")}
              >
                <option value="">
                  {repoOptions.length > 0
                    ? "Select a repository"
                    : "Validate a PAT to load repositories"}
                </option>
                {repoOptions.map((repo) => (
                  <option key={repo.fullName} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={updateProjectMutation.isPending || !githubRepo}
                onClick={() => {
                  void saveSelectedRepo();
                }}
                type="button"
              >
                Save Repository
              </Button>
            </div>
          </div>
        </Card>

        <Card surface="panel">
          <SectionHeader
            title="Model Configuration"
            summary="Choose the LLM provider and model for overview and planning work. Ollama saves and verifies when you select a model. OpenAI-compatible providers stay explicit."
            docs={[
              { label: "Planning workflow", to: "/docs/planning-workflow" },
            ]}
            badge={
              setupStatus?.llmVerified ? (
                <Badge tone="success">verified</Badge>
              ) : llmSaved ? (
                <Badge tone="neutral">saved</Badge>
              ) : null
            }
          />
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="llm-provider">LLM provider</Label>
                <Select
                  id="llm-provider"
                  onChange={(event) => {
                    const nextProvider = event.target.value as FormValues["llmProvider"];

                    setValue("llmProvider", nextProvider);
                    setValue("llmModel", "");

                    if (nextProvider === "ollama") {
                      void loadOllamaModels();
                      return;
                    }

                    setOllamaModels([]);
                  }}
                  value={llmProvider}
                >
                  <option value="">Select a provider</option>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI-compatible</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-model">Model</Label>
                {llmProvider === "ollama" ? (
                  <Select
                    disabled={loadLlmModelsMutation.isPending || ollamaModels.length === 0}
                    id="llm-model"
                    onChange={(event) => {
                      const nextModel = event.target.value;

                      setValue("llmModel", nextModel);

                      if (!nextModel.trim()) {
                        return;
                      }

                      void updateProjectMutation
                        .mutateAsync({
                          llmConfig: {
                            model: nextModel.trim(),
                            provider: "ollama",
                          },
                        })
                        .then(() => verifyLlmMutation.mutateAsync());
                    }}
                    value={llmModel}
                  >
                    <option value="">
                      {loadLlmModelsMutation.isPending
                        ? "Loading Ollama models"
                        : "Select a model"}
                    </option>
                    {ollamaModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id="llm-model"
                    disabled={!llmProvider}
                    onChange={(event) => {
                      setValue("llmModel", event.target.value);
                    }}
                    placeholder={
                      llmProvider === "openai"
                        ? "gpt-4.1"
                        : "Choose a provider to configure a model"
                    }
                    value={llmModel}
                  />
                )}
              </div>
            </div>
            {llmProvider === "ollama" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={loadLlmModelsMutation.isPending}
                  onClick={() => {
                    void loadOllamaModels();
                  }}
                  type="button"
                  variant="secondary"
                >
                  Refresh Models
                </Button>
                <p className="text-sm text-secondary">
                  Selecting an Ollama model saves it immediately and verifies the provider.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={updateProjectMutation.isPending || llmProvider !== "openai" || !llmModel.trim()}
                  onClick={() => {
                    void saveOpenAiLlm();
                  }}
                  type="button"
                >
                  Save LLM
                </Button>
                <Button
                  disabled={
                    verifyLlmMutation.isPending ||
                    updateProjectMutation.isPending ||
                    llmProvider !== "openai" ||
                    !llmModel.trim()
                  }
                  onClick={() => {
                    void saveOpenAiLlm().then(() => verifyLlmMutation.mutateAsync());
                  }}
                  type="button"
                  variant="secondary"
                >
                  Verify LLM
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card surface="panel">
          <SectionHeader
            title="Sandbox Defaults"
            summary="Define the limits Quayboard should use when testing sandbox startup. The first verification can pull the base image if it is missing locally."
            docs={[
              { label: "First install", to: "/docs/first-install" },
              { label: "Planning workflow", to: "/docs/planning-workflow" },
            ]}
            badge={
              setupStatus?.sandboxVerified ? (
                <Badge tone="success">verified</Badge>
              ) : sandboxSaved ? (
                <Badge tone="neutral">saved</Badge>
              ) : null
            }
          />
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="timeout-seconds">Timeout seconds</Label>
                <Input id="timeout-seconds" {...register("timeoutSeconds")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpu-limit">CPU limit</Label>
                <Input id="cpu-limit" {...register("cpuLimit")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memory-mb">Memory MB</Label>
                <Input id="memory-mb" {...register("memoryMb")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="egress-policy">Egress policy</Label>
              <Select id="egress-policy" {...register("egressPolicy")}>
                <option value="locked">Locked</option>
                <option value="allowlisted">Allowlisted</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sandbox-allowlist">Sandbox allowlist</Label>
              <Textarea
                id="sandbox-allowlist"
                placeholder="api.example.com, storage.example.com"
                {...register("sandboxAllowlist")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={updateProjectMutation.isPending}
                onClick={() => {
                  void saveSandbox();
                }}
                type="button"
              >
                Save Sandbox Defaults
              </Button>
              <Button
                disabled={verifySandboxMutation.isPending || updateProjectMutation.isPending}
                onClick={() => {
                  void saveSandbox()
                    .then(() => verifySandboxMutation.mutateAsync())
                    .catch(() => undefined);
                }}
                type="button"
                variant="secondary"
              >
                Verify Sandbox
              </Button>
            </div>
          </div>
        </Card>

        <Card surface="panel">
          <SectionHeader
            title="Evidence And Documentation"
            summary="Choose which documentation checkpoints matter before planning work can move forward for this project."
            docs={[
              { label: "Planning workflow", to: "/docs/planning-workflow" },
            ]}
            badge={evidenceSaved ? <Badge tone="success">saved</Badge> : null}
          />
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="require-user-docs">Require user docs</Label>
                <Select id="require-user-docs" {...register("requireUserDocs")}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="require-arch-docs">Require architecture docs</Label>
                <Select id="require-arch-docs" {...register("requireArchitectureDocs")}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={updateProjectMutation.isPending}
                onClick={() => {
                  void saveEvidencePolicy();
                }}
                type="button"
              >
                Save Documentation Policy
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppFrame>
  );
};
