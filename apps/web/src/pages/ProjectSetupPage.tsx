import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { PageIntro } from "../components/composites/PageIntro.js";
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
        <ProjectContextHeader
          project={projectQuery.data}
          setupStatus={setupStatusQuery.data}
        />
      ) : null}
      <PageIntro
        eyebrow="Project"
        title="Project Setup"
        summary="Connect the repo, configure the project-scoped LLM, define sandbox defaults, and verify the setup checklist."
        meta={
          <>
            <Badge tone="info">project-scoped secrets</Badge>
            <Badge
              tone={
                setupStatusQuery.data?.repoConnected &&
                setupStatusQuery.data.llmVerified &&
                setupStatusQuery.data.sandboxVerified
                  ? "success"
                  : "warning"
              }
            >
              readiness
            </Badge>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <Card surface="rail">
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
            <div className="grid gap-2 border-b border-border/70 pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Repository Access
              </p>
              <p className="text-sm text-muted-foreground">
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
            <div className="grid gap-2 border-b border-border/70 pt-2 pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Model Configuration
              </p>
              <p className="text-sm text-muted-foreground">
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
            <div className="grid gap-2 border-b border-border/70 pt-2 pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Sandbox Defaults
              </p>
              <p className="text-sm text-muted-foreground">
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
            <div className="grid gap-2 border-b border-border/70 pt-2 pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Evidence And Tools
              </p>
              <p className="text-sm text-muted-foreground">
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
            <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
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
        <Card surface="panel" className="h-fit">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold tracking-tight">Readiness Checklist</p>
            <Badge tone="warning">live status</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {setupStatusQuery.data?.checks.map((check) => (
              <div key={check.key} className="rounded-md border border-border/80 bg-panel/76 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{check.label}</p>
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
                <p className="mt-2 text-sm text-muted-foreground">{check.message}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppFrame>
  );
};
