import type { ProjectSetupState } from "@quayboard/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

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
  budgetCapUsd: string;
  cpuLimit: string;
  egressPolicy: "allowlisted" | "locked";
  enabledGroups: string;
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
  budgetCapUsd: "",
  cpuLimit: "1",
  egressPolicy: "locked",
  enabledGroups: "planning,review",
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

const buildProjectPayload = (
  values: FormValues,
  repoOptions: ReturnType<typeof buildRepoOptions>,
) => {
  const payload: UpdateProjectPayload = {
    evidencePolicy: {
      requireArchitectureDocs: values.requireArchitectureDocs === "true",
      requireUserDocs: values.requireUserDocs === "true",
    },
    sandboxConfig: {
      allowlist: values.sandboxAllowlist
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      cpuLimit: Number(values.cpuLimit),
      egressPolicy: values.egressPolicy,
      memoryMb: Number(values.memoryMb),
      timeoutSeconds: Number(values.timeoutSeconds),
    },
    toolPolicyPreview: {
      budgetCapUsd: values.budgetCapUsd ? Number(values.budgetCapUsd) : null,
      enabledGroups: values.enabledGroups
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    },
  };
  const selectedRepo = repoOptions.find((repo) => repo.fullName === values.githubRepo);

  if (selectedRepo) {
    payload.repoConfig = {
      owner: selectedRepo.owner,
      provider: "github",
      repo: selectedRepo.repo,
    };
  }

  if (values.llmProvider && values.llmModel.trim()) {
    payload.llmConfig = {
      model: values.llmModel.trim(),
      provider: values.llmProvider,
    };
  }

  return payload;
};

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
  const readinessComplete = Boolean(
    setupQuery.data?.status.repoConnected &&
      setupQuery.data.status.llmVerified &&
      setupQuery.data.status.sandboxVerified,
  );
  const repoOptions = buildRepoOptions(setupQuery.data);
  const {
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    defaultValues: defaultFormValues,
  });
  const githubPat = watch("githubPat");
  const llmModel = watch("llmModel");
  const llmProvider = watch("llmProvider");

  useEffect(() => {
    if (!setupQuery.data) {
      return;
    }

    reset({
      budgetCapUsd:
        setupQuery.data.toolPolicyPreview?.budgetCapUsd !== null &&
        setupQuery.data.toolPolicyPreview?.budgetCapUsd !== undefined
          ? String(setupQuery.data.toolPolicyPreview.budgetCapUsd)
          : "",
      cpuLimit: String(setupQuery.data.sandboxConfig?.cpuLimit ?? 1),
      egressPolicy: setupQuery.data.sandboxConfig?.egressPolicy ?? "locked",
      enabledGroups:
        setupQuery.data.toolPolicyPreview?.enabledGroups.join(",") ?? "planning,review",
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

  const llmProviderField = register("llmProvider", {
    onChange: (event) => {
      const nextProvider = event.target.value as FormValues["llmProvider"];

      setValue("llmModel", "");

      if (nextProvider === "ollama") {
        void loadLlmModelsMutation
          .mutateAsync({ provider: "ollama" })
          .then((response) => {
            setOllamaModels(response.models);
          });
        return;
      }

      setOllamaModels([]);
    },
  });

  const activeError =
    setupQuery.error ||
    updateProjectMutation.error ||
    validateGithubPatMutation.error ||
    loadLlmModelsMutation.error ||
    verifyLlmMutation.error ||
    verifySandboxMutation.error;

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectContextHeader project={projectQuery.data} setupStatus={setupQuery.data?.status} />
      ) : null}
      <PageIntro
        eyebrow="Project"
        title="Project Setup"
        summary="Connect the repo, configure the project-scoped LLM, define sandbox defaults, and verify the setup checklist."
        meta={
          <>
            <Badge tone="neutral">project-scoped setup</Badge>
            <Badge tone={readinessComplete ? "success" : "warning"}>readiness</Badge>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <Card surface="panel">
          <form
            className="grid gap-6"
            onSubmit={handleSubmit(async (values) => {
              await updateProjectMutation.mutateAsync(buildProjectPayload(values, repoOptions));
            })}
          >
            <div className="qb-section-heading">
              <p className="qb-meta-label">Repository access</p>
              <p className="text-sm text-secondary">
                Validate a PAT first, then pick one of the accessible repositories for this
                project.
              </p>
            </div>
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
                  {setupQuery.data?.repo.patConfigured ? "Refresh Repositories" : "Validate PAT"}
                </Button>
                {setupQuery.data?.repo.patConfigured ? (
                  <Badge tone="success">PAT saved</Badge>
                ) : null}
                {setupQuery.data?.repo.viewerLogin ? (
                  <p className="text-sm text-secondary">
                    Connected as {setupQuery.data.repo.viewerLogin}
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

            <div className="qb-section-heading border-t border-border/80 pt-5">
              <p className="qb-meta-label">Model configuration</p>
              <p className="text-sm text-secondary">
                Set the provider and model that overview and planning jobs should use.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="llm-provider">LLM provider</Label>
                <Select id="llm-provider" {...llmProviderField}>
                  <option value="">Select a provider</option>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI-compatible</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-model">Model</Label>
                {llmProvider === "ollama" ? (
                  <Select
                    id="llm-model"
                    disabled={loadLlmModelsMutation.isPending || ollamaModels.length === 0}
                    {...register("llmModel")}
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
                    placeholder={
                      llmProvider === "openai"
                        ? "gpt-4.1"
                        : "Choose a provider to configure a model"
                    }
                    {...register("llmModel")}
                  />
                )}
              </div>
            </div>

            <div className="qb-section-heading border-t border-border/80 pt-5">
              <p className="qb-meta-label">Sandbox defaults</p>
              <p className="text-sm text-secondary">
                Define execution limits and outbound access rules before verification.
              </p>
            </div>
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

            <div className="qb-section-heading border-t border-border/80 pt-5">
              <p className="qb-meta-label">Evidence and tools</p>
              <p className="text-sm text-secondary">
                Decide which docs matter for milestone completion and preview tool budget settings.
              </p>
            </div>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="enabled-groups">Enabled tool groups</Label>
                <Input id="enabled-groups" {...register("enabledGroups")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-cap">Budget cap USD</Label>
                <Input id="budget-cap" {...register("budgetCapUsd")} />
              </div>
            </div>

            {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}

            <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
              <Button disabled={updateProjectMutation.isPending} type="submit">
                Save Setup
              </Button>
              <Button
                  disabled={
                    verifyLlmMutation.isPending ||
                    updateProjectMutation.isPending ||
                    !llmProvider ||
                    !llmModel.trim()
                  }
                onClick={() => {
                  const values = getValues();

                  if (!values.llmProvider || !values.llmModel.trim()) {
                    return;
                  }

                  void updateProjectMutation
                    .mutateAsync({
                      llmConfig: {
                        model: values.llmModel.trim(),
                        provider: values.llmProvider,
                      },
                    })
                    .then(() => verifyLlmMutation.mutateAsync());
                }}
                type="button"
                variant="secondary"
              >
                Verify LLM
              </Button>
              <Button
                disabled={verifySandboxMutation.isPending || updateProjectMutation.isPending}
                onClick={() => {
                  const values = getValues();

                  void updateProjectMutation
                    .mutateAsync({
                      sandboxConfig: {
                        allowlist: values.sandboxAllowlist
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                        cpuLimit: Number(values.cpuLimit),
                        egressPolicy: values.egressPolicy,
                        memoryMb: Number(values.memoryMb),
                        timeoutSeconds: Number(values.timeoutSeconds),
                      },
                    })
                    .then(() => verifySandboxMutation.mutateAsync());
                }}
                type="button"
                variant="secondary"
              >
                Verify Sandbox
              </Button>
            </div>
          </form>
        </Card>
        <div className="grid gap-4">
          <Card surface="rail" className="h-fit">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Checklist</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Readiness Checklist</p>
              </div>
              <Badge tone={readinessComplete ? "success" : "warning"}>live status</Badge>
            </div>
            <div className="mt-4 grid gap-0 border border-border/80">
              {setupQuery.data?.status.checks.map((check) => (
                <div
                  key={check.key}
                  className="grid gap-2 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{check.label}</p>
                    <Badge
                      tone={
                        check.status === "pass"
                          ? "success"
                          : check.status === "warn"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {check.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-secondary">{check.message}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card surface="inset" className="h-fit">
            <p className="qb-meta-label">Controls</p>
            <div className="mt-4 grid gap-2">
              <div className="qb-kv">
                <p className="qb-meta-label">Verification</p>
                <p className="text-sm text-foreground">
                  Repo, provider, and sandbox checks stay explicit and reviewable.
                </p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Scope</p>
                <p className="text-sm text-foreground">
                  Credentials and setup state remain project-scoped for the current milestone.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
};
