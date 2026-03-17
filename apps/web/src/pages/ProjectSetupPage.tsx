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
  useCreateSecretMutation,
  useProjectQuery,
  useSetupStatusQuery,
  useUpdateProjectMutation,
  useVerifyLlmMutation,
  useVerifySandboxMutation,
} from "../hooks/use-projects.js";

type FormValues = {
  budgetCapUsd: string;
  cpuLimit: string;
  egressPolicy: "allowlisted" | "locked";
  enabledGroups: string;
  githubOwner: string;
  githubPat: string;
  githubRepo: string;
  llmModel: string;
  llmProvider: "ollama" | "openai";
  memoryMb: string;
  requireArchitectureDocs: string;
  requireUserDocs: string;
  sandboxAllowlist: string;
  timeoutSeconds: string;
};

export const ProjectSetupPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const setupStatusQuery = useSetupStatusQuery(id);
  const updateProjectMutation = useUpdateProjectMutation(id);
  const createSecretMutation = useCreateSecretMutation(id);
  const verifyLlmMutation = useVerifyLlmMutation(id);
  const verifySandboxMutation = useVerifySandboxMutation(id);
  const readinessComplete = Boolean(
    setupStatusQuery.data?.repoConnected &&
      setupStatusQuery.data.llmVerified &&
      setupStatusQuery.data.sandboxVerified,
  );

  const { handleSubmit, register } = useForm<FormValues>({
    defaultValues: {
      budgetCapUsd: "",
      cpuLimit: "1",
      egressPolicy: "locked",
      enabledGroups: "planning,review",
      githubOwner: "",
      githubPat: "",
      githubRepo: "",
      llmModel: "llama3.2",
      llmProvider: "ollama",
      memoryMb: "1024",
      requireArchitectureDocs: "false",
      requireUserDocs: "false",
      sandboxAllowlist: "",
      timeoutSeconds: "300",
    },
  });

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectContextHeader project={projectQuery.data} setupStatus={setupStatusQuery.data} />
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
              if (values.githubPat.trim()) {
                await createSecretMutation.mutateAsync({
                  type: "github_pat",
                  value: values.githubPat.trim(),
                });
              }

              await updateProjectMutation.mutateAsync({
                evidencePolicy: {
                  requireArchitectureDocs: values.requireArchitectureDocs === "true",
                  requireUserDocs: values.requireUserDocs === "true",
                },
                llmConfig: {
                  model: values.llmModel,
                  provider: values.llmProvider,
                },
                repoConfig: {
                  owner: values.githubOwner,
                  provider: "github",
                  repo: values.githubRepo,
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
              });
            })}
          >
            <div className="qb-section-heading">
              <p className="qb-meta-label">Repository access</p>
              <p className="text-sm text-secondary">
                Connect the target repository and optionally store a PAT for verification.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="github-owner">GitHub owner</Label>
                <Input id="github-owner" {...register("githubOwner")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-repo">GitHub repo</Label>
                <Input id="github-repo" {...register("githubRepo")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-pat">GitHub PAT</Label>
              <Input id="github-pat" type="password" {...register("githubPat")} />
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
                <Select id="llm-provider" {...register("llmProvider")}>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI-compatible</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-model">Model</Label>
                <Input id="llm-model" {...register("llmModel")} />
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

            {(updateProjectMutation.error ||
              createSecretMutation.error ||
              verifyLlmMutation.error ||
              verifySandboxMutation.error) && (
              <Alert tone="error">
                {updateProjectMutation.error?.message ||
                  createSecretMutation.error?.message ||
                  verifyLlmMutation.error?.message ||
                  verifySandboxMutation.error?.message}
              </Alert>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
              <Button disabled={updateProjectMutation.isPending} type="submit">
                Save Setup
              </Button>
              <Button
                disabled={verifyLlmMutation.isPending}
                onClick={() => {
                  void verifyLlmMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Verify LLM
              </Button>
              <Button
                disabled={verifySandboxMutation.isPending}
                onClick={() => {
                  void verifySandboxMutation.mutateAsync();
                }}
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
              {setupStatusQuery.data?.checks.map((check) => (
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
