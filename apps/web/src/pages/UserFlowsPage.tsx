import { useState } from "react";
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
import { Textarea } from "../components/ui/Textarea.js";
import {
  useApproveUserFlowsMutation,
  useCreateUserFlowMutation,
  useDeleteUserFlowMutation,
  useDedupeUserFlowsMutation,
  useGenerateUserFlowsMutation,
  useProjectQuery,
  useSetupStatusQuery,
  useUserFlowsQuery,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

type FormValues = {
  acceptanceCriteria: string;
  coverageTags: string;
  endState: string;
  entryPoint: string;
  flowSteps: string;
  title: string;
  userStory: string;
};

export const UserFlowsPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const setupStatusQuery = useSetupStatusQuery(id);
  const userFlowsQuery = useUserFlowsQuery(id);
  const createUserFlowMutation = useCreateUserFlowMutation(id);
  const deleteUserFlowMutation = useDeleteUserFlowMutation(id);
  const generateUserFlowsMutation = useGenerateUserFlowsMutation(id);
  const dedupeUserFlowsMutation = useDedupeUserFlowsMutation(id);
  const approveUserFlowsMutation = useApproveUserFlowsMutation(id);
  const [acceptedWarnings, setAcceptedWarnings] = useState<string[]>([]);
  const { handleSubmit, register, reset } = useForm<FormValues>({
    defaultValues: {
      acceptanceCriteria: "",
      coverageTags: "happy-path",
      endState: "",
      entryPoint: "",
      flowSteps: "",
      title: "",
      userStory: "",
    },
  });

  useSseEvents(id);

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectContextHeader project={projectQuery.data} setupStatus={setupStatusQuery.data} />
      ) : null}
      <PageIntro
        eyebrow="User Flows"
        title="User Flows"
        summary="Generate, edit, and approve the user-facing journeys that become the planning contract for later stages."
        meta={
          <>
            <Badge tone="neutral">planning contract</Badge>
            <Badge tone="neutral">{userFlowsQuery.data?.userFlows.length ?? 0} flows</Badge>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Flow controls</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Generation And Approval</p>
              </div>
              <Badge tone={userFlowsQuery.data?.approvedAt ? "success" : "warning"}>
                {userFlowsQuery.data?.approvedAt ? "approved" : "review required"}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={generateUserFlowsMutation.isPending}
                onClick={() => {
                  void generateUserFlowsMutation.mutateAsync();
                }}
              >
                Generate Flows
              </Button>
              <Button
                disabled={dedupeUserFlowsMutation.isPending}
                onClick={() => {
                  void dedupeUserFlowsMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Deduplicate
              </Button>
              <Button
                disabled={approveUserFlowsMutation.isPending}
                onClick={() => {
                  void approveUserFlowsMutation.mutateAsync(acceptedWarnings);
                }}
                variant="secondary"
              >
                Approve User Flows
              </Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="qb-kv">
                <p className="qb-meta-label">Flows</p>
                <p className="text-sm text-foreground">
                  {userFlowsQuery.data?.userFlows.length ?? 0} tracked journeys
                </p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Warnings</p>
                <p className="text-sm text-foreground">
                  {userFlowsQuery.data?.coverage.warnings.length ?? 0} coverage warnings
                </p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Approval</p>
                <p className="text-sm text-foreground">
                  {userFlowsQuery.data?.approvedAt
                    ? formatDateTime(userFlowsQuery.data.approvedAt)
                    : "Pending review"}
                </p>
              </div>
            </div>
            {approveUserFlowsMutation.error ? (
              <Alert tone="error" className="mt-4">
                {approveUserFlowsMutation.error.message}
              </Alert>
            ) : null}
          </Card>
          <Card surface="panel">
            <div className="border-b border-border/80 pb-3">
              <p className="qb-meta-label">Manual intake</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Add User Flow</p>
            </div>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleSubmit(async (values) => {
                await createUserFlowMutation.mutateAsync({
                  acceptanceCriteria: values.acceptanceCriteria
                    .split("\n")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  coverageTags: values.coverageTags
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  doneCriteriaRefs: ["manual"],
                  endState: values.endState,
                  entryPoint: values.entryPoint,
                  flowSteps: values.flowSteps
                    .split("\n")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  source: "manual",
                  title: values.title,
                  userStory: values.userStory,
                });
                reset();
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="flow-title">Title</Label>
                <Input id="flow-title" {...register("title")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-story">User story</Label>
                <Textarea id="flow-story" {...register("userStory")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="flow-entry">Entry point</Label>
                  <Input id="flow-entry" {...register("entryPoint")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flow-end">End state</Label>
                  <Input id="flow-end" {...register("endState")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-steps">Flow steps</Label>
                <Textarea id="flow-steps" {...register("flowSteps")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverage-tags">Coverage tags</Label>
                <Input id="coverage-tags" {...register("coverageTags")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acceptance-criteria">Acceptance criteria</Label>
                <Textarea id="acceptance-criteria" {...register("acceptanceCriteria")} />
              </div>
              {createUserFlowMutation.error ? (
                <Alert tone="error">{createUserFlowMutation.error.message}</Alert>
              ) : null}
              <div className="border-t border-border/80 pt-4">
                <Button disabled={createUserFlowMutation.isPending} type="submit">
                  Save User Flow
                </Button>
              </div>
            </form>
          </Card>
          <Card surface="rail">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Catalogue</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Planned journeys</p>
              </div>
              <Badge tone="neutral">{userFlowsQuery.data?.userFlows.length ?? 0} items</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {userFlowsQuery.data?.userFlows.map((flow) => (
                <Card key={flow.id} surface="inset">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tracking-[-0.02em]">{flow.title}</p>
                        <Badge tone="neutral">{flow.source}</Badge>
                      </div>
                      <p className="text-sm text-secondary">{flow.userStory}</p>
                    </div>
                    <Button
                      disabled={deleteUserFlowMutation.isPending}
                      onClick={() => {
                        void deleteUserFlowMutation.mutateAsync(flow.id);
                      }}
                      variant="ghost"
                    >
                      Archive
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <div className="qb-kv">
                      <p className="qb-meta-label">Entry</p>
                      <p className="text-sm text-foreground">{flow.entryPoint}</p>
                    </div>
                    <div className="qb-kv">
                      <p className="qb-meta-label">End state</p>
                      <p className="text-sm text-foreground">{flow.endState}</p>
                    </div>
                    <div className="qb-kv">
                      <p className="qb-meta-label">Criteria</p>
                      <p className="text-sm text-foreground">
                        {flow.acceptanceCriteria.length} acceptance checks
                      </p>
                    </div>
                    <div className="qb-kv">
                      <p className="qb-meta-label">Updated</p>
                      <p className="text-sm text-foreground">{formatDateTime(flow.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {flow.coverageTags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="qb-meta-label">Flow steps</p>
                      <ul className="mt-2 grid gap-2 text-sm text-secondary">
                        {flow.flowSteps.map((step, index) => (
                          <li
                            key={`${flow.id}-step-${index}`}
                            className="border border-border/70 bg-panel px-3 py-2"
                          >
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="qb-meta-label">Acceptance criteria</p>
                      <ul className="mt-2 grid gap-2 text-sm text-secondary">
                        {flow.acceptanceCriteria.map((criterion, index) => (
                          <li
                            key={`${flow.id}-criterion-${index}`}
                            className="border border-border/70 bg-panel px-3 py-2"
                          >
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-4">
          <Card surface="rail" className="h-fit">
            <p className="qb-meta-label">Coverage summary</p>
            <div className="mt-4 grid gap-2">
              <div className="qb-kv">
                <p className="qb-meta-label">Warnings accepted</p>
                <p className="text-sm text-foreground">{acceptedWarnings.length} selected warnings</p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Approved at</p>
                <p className="text-sm text-foreground">
                  {userFlowsQuery.data?.approvedAt
                    ? formatDateTime(userFlowsQuery.data.approvedAt)
                    : "Pending review"}
                </p>
              </div>
            </div>
          </Card>
          <Card surface="rail" className="h-fit">
            <div className="border-b border-border/80 pb-3">
              <p className="qb-meta-label">Review items</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Coverage Warnings</p>
            </div>
            <div className="mt-4 grid gap-3">
              {userFlowsQuery.data?.coverage.warnings.map((warning) => (
                <div key={warning} className="border border-border/80 bg-panel-inset p-4">
                  <p className="text-sm text-secondary">{warning}</p>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => {
                      setAcceptedWarnings((current) =>
                        current.includes(warning)
                          ? current.filter((item) => item !== warning)
                          : [...current, warning],
                      );
                    }}
                    variant={acceptedWarnings.includes(warning) ? "primary" : "ghost"}
                  >
                    {acceptedWarnings.includes(warning) ? "Accepted" : "Accept Warning"}
                  </Button>
                </div>
              ))}
              {userFlowsQuery.data?.coverage.warnings.length === 0 ? (
                <div className="qb-data-row text-sm text-secondary">
                  No coverage warnings are currently open.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
};
