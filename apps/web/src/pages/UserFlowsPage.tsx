import type { UseCase } from "@quayboard/shared";
import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import {
  findLatestJob,
  getDefaultJobFailureHint,
  getJobErrorMessage,
  LatestJobFailureAlert,
} from "../components/workflow/LatestJobFailureAlert.js";
import { Alert } from "../components/ui/Alert.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
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
  useGenerateUserFlowsMutation,
  useProjectJobsQuery,
  useProjectQuery,
  useUpdateUserFlowMutation,
  useUserFlowsQuery,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

const generateUserFlowJobTypes = new Set(["GenerateUseCases"]);

type FormValues = {
  acceptanceCriteria: string;
  coverageTags: string;
  endState: string;
  entryPoint: string;
  flowSteps: string;
  title: string;
  userStory: string;
};

const defaultFormValues: FormValues = {
  acceptanceCriteria: "",
  coverageTags: "happy-path",
  endState: "",
  entryPoint: "",
  flowSteps: "",
  title: "",
  userStory: "",
};

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const toFormValues = (flow: UseCase): FormValues => ({
  acceptanceCriteria: flow.acceptanceCriteria.join("\n"),
  coverageTags: flow.coverageTags.join(", "),
  endState: flow.endState,
  entryPoint: flow.entryPoint,
  flowSteps: flow.flowSteps.join("\n"),
  title: flow.title,
  userStory: flow.userStory,
});

const toPayload = (values: FormValues, flow?: UseCase) => ({
  acceptanceCriteria: splitLines(values.acceptanceCriteria),
  coverageTags: splitCsv(values.coverageTags),
  doneCriteriaRefs: flow?.doneCriteriaRefs ?? ["manual"],
  endState: values.endState,
  entryPoint: values.entryPoint,
  flowSteps: splitLines(values.flowSteps),
  source: flow?.source ?? "manual",
  title: values.title,
  userStory: values.userStory,
});

const UserFlowFields = ({
  formId,
  register,
}: {
  formId: string;
  register: UseFormRegister<FormValues>;
}) => (
  <>
    <div className="space-y-2">
      <Label htmlFor={`${formId}-title`}>Title</Label>
      <Input id={`${formId}-title`} {...register("title")} />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${formId}-story`}>User story</Label>
      <Textarea id={`${formId}-story`} {...register("userStory")} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${formId}-entry`}>Entry point</Label>
        <Input id={`${formId}-entry`} {...register("entryPoint")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${formId}-end`}>End state</Label>
        <Input id={`${formId}-end`} {...register("endState")} />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${formId}-steps`}>Flow steps</Label>
      <Textarea id={`${formId}-steps`} {...register("flowSteps")} />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${formId}-coverage`}>Coverage tags</Label>
      <Input id={`${formId}-coverage`} {...register("coverageTags")} />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${formId}-criteria`}>Acceptance criteria</Label>
      <Textarea id={`${formId}-criteria`} {...register("acceptanceCriteria")} />
    </div>
  </>
);

export const UserFlowsPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const userFlowsQuery = useUserFlowsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const createUserFlowMutation = useCreateUserFlowMutation(id);
  const updateUserFlowMutation = useUpdateUserFlowMutation(id);
  const deleteUserFlowMutation = useDeleteUserFlowMutation(id);
  const generateUserFlowsMutation = useGenerateUserFlowsMutation(id);
  const approveUserFlowsMutation = useApproveUserFlowsMutation(id);
  const [acceptedWarnings, setAcceptedWarnings] = useState<string[]>([]);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const createForm = useForm<FormValues>({
    defaultValues: defaultFormValues,
  });
  const editForm = useForm<FormValues>({
    defaultValues: defaultFormValues,
  });

  useSseEvents(id);

  useEffect(() => {
    setAcceptedWarnings(userFlowsQuery.data?.coverage.acceptedWarnings ?? []);
  }, [userFlowsQuery.data?.coverage.acceptedWarnings]);

  useEffect(() => {
    if (
      editingFlowId &&
      !userFlowsQuery.data?.userFlows.some((flow) => flow.id === editingFlowId)
    ) {
      setEditingFlowId(null);
    }
  }, [editingFlowId, userFlowsQuery.data?.userFlows]);

  const activeGenerateUserFlowsJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          generateUserFlowJobTypes.has(job.type) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const latestFailedGenerateUserFlowsJob = useMemo(
    () =>
      findLatestJob(
        jobsQuery.data?.jobs,
        (job) =>
          generateUserFlowJobTypes.has(job.type) &&
          (job.status === "failed" || job.status === "cancelled"),
      ),
    [jobsQuery.data?.jobs],
  );
  const generateFlowsButtonActive =
    generateUserFlowsMutation.isPending || Boolean(activeGenerateUserFlowsJob);

  return (
    <AppFrame>
      {projectQuery.data ? <ProjectSubNav project={projectQuery.data} /> : null}
      <PageIntro
        eyebrow="User Flows"
        title="User Flows"
        summary="Use this page to build the journeys the team must support, review coverage warnings, and approve the flow set that will guide milestone and feature planning."
        meta={
          <>
            <Badge tone="neutral">planning contract</Badge>
            <Badge tone="neutral">{userFlowsQuery.data?.userFlows.length ?? 0} flows</Badge>
          </>
        }
      />
      {!activeGenerateUserFlowsJob ? (
        <LatestJobFailureAlert
          currentVersionStillAvailable={Boolean(userFlowsQuery.data?.userFlows.length)}
          hint={
            latestFailedGenerateUserFlowsJob && getJobErrorMessage(latestFailedGenerateUserFlowsJob)
              ? getDefaultJobFailureHint(
                  getJobErrorMessage(latestFailedGenerateUserFlowsJob)!,
                  "User Flow generation",
                )
              : null
          }
          job={latestFailedGenerateUserFlowsJob}
          workflowLabel="User Flow generation"
        />
      ) : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <div className="grid self-start gap-4">
          <Card surface="panel">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Flow controls</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  Generation And Approval
                </p>
              </div>
              <Badge tone={userFlowsQuery.data?.approvedAt ? "success" : "warning"}>
                {userFlowsQuery.data?.approvedAt ? "approved" : "review required"}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AiWorkflowButton
                active={generateFlowsButtonActive}
                disabled={generateFlowsButtonActive}
                label="Generate Flows"
                onClick={() => {
                  void generateUserFlowsMutation.mutateAsync();
                }}
                runningLabel="Generating Flows"
                variant="secondary"
              />
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
              onSubmit={createForm.handleSubmit(async (values) => {
                await createUserFlowMutation.mutateAsync(toPayload(values));
                createForm.reset(defaultFormValues);
              })}
            >
              <UserFlowFields formId="create-flow" register={createForm.register} />
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
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  Planned journeys
                </p>
              </div>
              <Badge tone="neutral">{userFlowsQuery.data?.userFlows.length ?? 0} items</Badge>
            </div>
            {deleteUserFlowMutation.error ? (
              <Alert tone="error" className="mt-4">
                {deleteUserFlowMutation.error.message}
              </Alert>
            ) : null}
            <div className="mt-4 grid gap-3">
              {userFlowsQuery.data?.userFlows.map((flow) =>
                editingFlowId === flow.id ? (
                  <Card key={flow.id} surface="inset">
                    <form
                      className="grid gap-4"
                      onSubmit={editForm.handleSubmit(async (values) => {
                        await updateUserFlowMutation.mutateAsync({
                          payload: toPayload(values, flow),
                          userFlowId: flow.id,
                        });
                        setEditingFlowId(null);
                      })}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-3">
                        <div className="grid gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold tracking-[-0.02em]">Edit User Flow</p>
                            <Badge tone="neutral">{flow.source}</Badge>
                          </div>
                          <p className="text-sm text-secondary">
                            Update the journey details and save them back to the active flow set.
                          </p>
                        </div>
                        <p className="qb-meta-label">updated {formatDateTime(flow.updatedAt)}</p>
                      </div>
                      <UserFlowFields formId={`edit-flow-${flow.id}`} register={editForm.register} />
                      {updateUserFlowMutation.error ? (
                        <Alert tone="error">{updateUserFlowMutation.error.message}</Alert>
                      ) : null}
                      <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
                        <Button disabled={updateUserFlowMutation.isPending} type="submit">
                          Save Changes
                        </Button>
                        <Button
                          disabled={updateUserFlowMutation.isPending}
                          onClick={() => {
                            editForm.reset(toFormValues(flow));
                            setEditingFlowId(null);
                          }}
                          type="button"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Card>
                ) : (
                  <Card key={flow.id} surface="inset">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1 grid gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold tracking-[-0.02em]">{flow.title}</p>
                          <Badge tone="neutral">{flow.source}</Badge>
                        </div>
                        <p className="break-words text-sm text-secondary">{flow.userStory}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:justify-end">
                        <Button
                          disabled={updateUserFlowMutation.isPending}
                          onClick={() => {
                            editForm.reset(toFormValues(flow));
                            setEditingFlowId(flow.id);
                          }}
                          type="button"
                          variant="ghost"
                        >
                          Edit
                        </Button>
                        <Button
                          disabled={deleteUserFlowMutation.isPending}
                          onClick={() => {
                            void deleteUserFlowMutation.mutateAsync(flow.id);
                          }}
                          type="button"
                          variant="ghost"
                        >
                          Archive
                        </Button>
                      </div>
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
                        <p className="text-sm text-foreground">
                          {formatDateTime(flow.updatedAt)}
                        </p>
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
                ),
              )}
            </div>
          </Card>
        </div>
        <div className="grid gap-4">
          <Card surface="rail" className="h-fit">
            <p className="qb-meta-label">Coverage summary</p>
            <div className="mt-4 grid gap-2">
              <div className="qb-kv">
                <p className="qb-meta-label">Warnings accepted</p>
                <p className="text-sm text-foreground">
                  {acceptedWarnings.length} selected warnings
                </p>
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
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                Coverage Warnings
              </p>
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
