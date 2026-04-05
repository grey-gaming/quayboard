import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Job, Milestone } from "@quayboard/shared";

import { EditableMarkdownDocument } from "../components/composites/EditableMarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { buildProductDesignTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import {
  findLatestFailedJob,
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
import { Checkbox } from "../components/ui/Checkbox.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useApproveMilestoneDesignMutation,
  useCreateMilestoneMutation,
  useGenerateMilestoneDesignMutation,
  useGenerateMilestonesMutation,
  useMilestoneDesignDocsQuery,
  useMilestonesQuery,
  useProjectJobsQuery,
  useProjectQuery,
  useReviewMilestoneMapMutation,
  useReviewMilestoneScopeMutation,
  useTransitionMilestoneMutation,
  useUpdateMilestoneDesignMutation,
  useUpdateMilestoneMutation,
  useUserFlowsQuery,
} from "../hooks/use-projects.js";
import { useJobDrivenRefresh } from "../hooks/use-job-driven-refresh.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const isActiveJob = (job: Job) => job.status === "queued" || job.status === "running";
const jobTargetsMilestone = (job: Job, milestoneId: string) =>
  typeof job.inputs === "object" &&
  job.inputs !== null &&
  "milestoneId" in job.inputs &&
  job.inputs.milestoneId === milestoneId;

const toggleSelectedFlow = (selectedUseCaseIds: string[], flowId: string, checked: boolean) =>
  checked
    ? selectedUseCaseIds.includes(flowId)
      ? selectedUseCaseIds
      : [...selectedUseCaseIds, flowId]
    : selectedUseCaseIds.filter((id) => id !== flowId);

type MilestoneDesignCardProps = {
  milestone: Milestone;
  projectId: string;
  jobs: Job[] | undefined;
  isExpanded: boolean;
};

const MilestoneDesignCard = ({
  milestone,
  projectId,
  jobs,
  isExpanded,
}: MilestoneDesignCardProps) => {
  const designDocsQuery = useMilestoneDesignDocsQuery(isExpanded ? milestone.id : null);
  const generateDesignMutation = useGenerateMilestoneDesignMutation(projectId, milestone.id);
  const approveDesignMutation = useApproveMilestoneDesignMutation(projectId, milestone.id);
  const updateDesignMutation = useUpdateMilestoneDesignMutation(projectId, milestone.id);

  const activeMilestoneDesignJob = useMemo(
    () =>
      jobs?.find(
        (job) =>
          job.type === "GenerateMilestoneDesign" &&
          jobTargetsMilestone(job, milestone.id) &&
          isActiveJob(job),
      ) ?? null,
    [jobs, milestone.id],
  );
  const latestFailedMilestoneDesignJob = useMemo(
    () =>
      findLatestFailedJob(
        jobs,
        (job) => job.type === "GenerateMilestoneDesign" && jobTargetsMilestone(job, milestone.id),
      ),
    [jobs, milestone.id],
  );
  const latestMilestoneDesignJob = useMemo(
    () =>
      findLatestJob(
        jobs,
        (job) => job.type === "GenerateMilestoneDesign" && jobTargetsMilestone(job, milestone.id),
      ),
    [jobs, milestone.id],
  );
  const milestoneDesignButtonActive =
    generateDesignMutation.isPending || Boolean(activeMilestoneDesignJob);
  const currentDesignDoc = designDocsQuery.data?.designDocs[0];
  const designDocError =
    designDocsQuery.error ||
    generateDesignMutation.error ||
    approveDesignMutation.error ||
    updateDesignMutation.error;

  useJobDrivenRefresh({
    active: isExpanded && Boolean(activeMilestoneDesignJob),
    latestJob: latestMilestoneDesignJob,
    queryKeys: [["milestone", milestone.id, "design-docs"]],
  });

  return (
    <div className="mt-4 border-t border-border/80 pt-4">
      {isExpanded ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="qb-meta-label">Design doc</p>
              <p className="mt-1 text-sm text-secondary">
                Generate or edit the milestone design document before approving the milestone.
              </p>
            </div>
            <AiWorkflowButton
              active={milestoneDesignButtonActive}
              disabled={
                milestoneDesignButtonActive || milestone.status !== "draft" || !milestone.isActive
              }
              label="Generate Design Document"
              onClick={() => {
                void generateDesignMutation.mutateAsync().catch(() => undefined);
              }}
              runningLabel="Generating..."
              variant="secondary"
            />
          </div>
          {activeMilestoneDesignJob ? (
            <Alert tone="info">
              Milestone design doc generation is {activeMilestoneDesignJob.status}. The milestone
              card will refresh automatically when the job completes.
            </Alert>
          ) : null}
          {!activeMilestoneDesignJob ? (
            <LatestJobFailureAlert
              currentVersionStillAvailable={Boolean(currentDesignDoc)}
              hint={
                latestFailedMilestoneDesignJob && getJobErrorMessage(latestFailedMilestoneDesignJob)
                  ? getDefaultJobFailureHint(
                      getJobErrorMessage(latestFailedMilestoneDesignJob)!,
                      "milestone design doc generation",
                    )
                  : null
              }
              job={latestFailedMilestoneDesignJob}
              workflowLabel="Milestone design doc generation"
            />
          ) : null}
          {designDocError ? <Alert tone="error">{designDocError.message}</Alert> : null}
          <Card surface="inset">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="qb-meta-label">Current revision</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  {currentDesignDoc?.title ?? "No design doc yet"}
                </p>
                <p className="mt-2 text-sm text-secondary">
                  Linked journeys: {milestone.linkedUserFlows.map((flow) => flow.title).join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentDesignDoc && !currentDesignDoc.approval ? (
                  <Button
                    disabled={milestone.status !== "approved"}
                    onClick={() => {
                      void approveDesignMutation.mutateAsync(currentDesignDoc.id).catch(() => undefined);
                    }}
                    variant="secondary"
                  >
                    Approve design doc
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {currentDesignDoc ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {currentDesignDoc.approval ? (
                      <Badge tone="success">approved</Badge>
                    ) : (
                      <Badge tone="warning">approval required</Badge>
                    )}
                    <Badge tone="neutral">
                      linked flows covered: {milestone.linkedUserFlows.length}
                    </Badge>
                  </div>
                  <EditableMarkdownDocument
                    disabled={milestone.status !== "draft" || !milestone.isActive}
                    editLabel="Edit Markdown"
                    isSaving={updateDesignMutation.isPending}
                    markdown={currentDesignDoc.markdown}
                    onSave={(markdown) =>
                      updateDesignMutation.mutateAsync({ markdown }).catch(() => undefined)
                    }
                    saveLabel="Save milestone document"
                  />
                </>
              ) : (
                <p className="text-sm text-secondary">
                  No milestone design doc exists for this milestone yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export const MilestonesPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const userFlowsQuery = useUserFlowsQuery(id);
  const milestonesQuery = useMilestonesQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const createMilestoneMutation = useCreateMilestoneMutation(id);
  const updateMilestoneMutation = useUpdateMilestoneMutation(id);
  const transitionMilestoneMutation = useTransitionMilestoneMutation(id);
  const reviewMilestoneMapMutation = useReviewMilestoneMapMutation(id);
  const reviewMilestoneScopeMutation = useReviewMilestoneScopeMutation(id);
  const generateMilestonesMutation = useGenerateMilestonesMutation(id);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [expandedDesignMilestoneId, setExpandedDesignMilestoneId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedUseCaseIds, setSelectedUseCaseIds] = useState<string[]>([]);

  useSseEvents(id);

  const activeMilestones = milestonesQuery.data?.milestones ?? [];
  const canSubmit = title.trim() && summary.trim() && selectedUseCaseIds.length > 0;
  const activeMilestonePlanJob = useMemo(
    () => jobsQuery.data?.jobs.find((job) => job.type === "GenerateMilestones" && isActiveJob(job)) ?? null,
    [jobsQuery.data?.jobs],
  );
  const latestFailedMilestonePlanJob = useMemo(
    () => findLatestFailedJob(jobsQuery.data?.jobs, (job) => job.type === "GenerateMilestones"),
    [jobsQuery.data?.jobs],
  );
  const latestMilestonePlanJob = useMemo(
    () => findLatestJob(jobsQuery.data?.jobs, (job) => job.type === "GenerateMilestones"),
    [jobsQuery.data?.jobs],
  );
  const activeError =
    projectQuery.error ||
    userFlowsQuery.error ||
    milestonesQuery.error ||
    jobsQuery.error ||
    createMilestoneMutation.error ||
    updateMilestoneMutation.error ||
    transitionMilestoneMutation.error ||
    reviewMilestoneMapMutation.error ||
    reviewMilestoneScopeMutation.error ||
    generateMilestonesMutation.error;
  const milestonePlanButtonActive =
    generateMilestonesMutation.isPending || Boolean(activeMilestonePlanJob);
  const milestoneMapReview = milestonesQuery.data?.mapReview ?? {
    generatedAt: activeMilestones.length > 0 ? new Date().toISOString() : null,
    reviewStatus: activeMilestones.length > 0 ? ("passed" as const) : ("not_started" as const),
    reviewIssues: [],
    reviewedAt: null,
  };

  const resetForm = () => {
    setEditingMilestoneId(null);
    setTitle("");
    setSummary("");
    setSelectedUseCaseIds([]);
    setIsFormOpen(false);
  };

  const openCreatePanel = () => {
    setEditingMilestoneId(null);
    setTitle("");
    setSummary("");
    setSelectedUseCaseIds([]);
    setIsFormOpen(true);
  };

  const openEditPanel = (milestone: Milestone) => {
    setEditingMilestoneId(milestone.id);
    setTitle(milestone.title);
    setSummary(milestone.summary);
    setSelectedUseCaseIds(milestone.linkedUserFlows.map((flow) => flow.id));
    setIsFormOpen(true);
  };

  useJobDrivenRefresh({
    active: Boolean(activeMilestonePlanJob),
    latestJob: latestMilestonePlanJob,
    queryKeys: [["project", id, "milestones"]],
  });

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  return (
    <ProjectPageFrame
      activeSection="product-design"
      project={projectQuery.data}
      tertiaryItems={buildProductDesignTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Milestones"
        title="Milestones"
        summary="Plan releasable increments from the approved user-flow contract, prepare a design document for each milestone, then approve the milestones that are ready for feature work."
        meta={
          <>
            <Badge tone="neutral">{activeMilestones.length} milestones</Badge>
            <Badge tone="neutral">
              {milestonesQuery.data?.coverage.coveredUserFlowCount ?? 0}/
              {milestonesQuery.data?.coverage.approvedUserFlowCount ?? 0} journeys covered
            </Badge>
          </>
        }
      />
      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}
      {activeMilestonePlanJob ? (
        <Alert tone="info">
          Milestone generation is {activeMilestonePlanJob.status}. The page will refresh
          automatically when the job completes.
        </Alert>
      ) : null}
      {!activeMilestonePlanJob ? (
        <LatestJobFailureAlert
          currentVersionStillAvailable={Boolean(activeMilestones.length)}
          hint={
            latestFailedMilestonePlanJob && getJobErrorMessage(latestFailedMilestonePlanJob)
              ? getDefaultJobFailureHint(
                  getJobErrorMessage(latestFailedMilestonePlanJob)!,
                  "milestone generation",
                )
              : null
          }
          job={latestFailedMilestonePlanJob}
          workflowLabel="Milestone generation"
        />
      ) : null}
      <div className="grid gap-4">
        <Card surface="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="qb-meta-label">Milestone controls</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Roadmap intake</p>
              <p className="mt-2 text-sm text-secondary">
                Generate the milestone map first, review it at the project level, then approve and
                plan the active milestone.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (isFormOpen && !editingMilestoneId) {
                    resetForm();
                    return;
                  }
                  openCreatePanel();
                }}
                variant="primary"
              >
                {isFormOpen && !editingMilestoneId ? "Hide Add Milestone" : "Add Milestone"}
              </Button>
              <AiWorkflowButton
                active={milestonePlanButtonActive}
                disabled={milestonePlanButtonActive}
                label="Generate Milestones"
                onClick={() => {
                  void generateMilestonesMutation.mutateAsync().catch(() => undefined);
                }}
                runningLabel="Generating milestones..."
                variant="secondary"
              />
            </div>
          </div>
          {isFormOpen ? (
            <div className="mt-4 border-t border-border/80 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="qb-meta-label">Milestone intake</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {editingMilestoneId ? "Edit milestone" : "Create milestone"}
                  </p>
                </div>
                <Button onClick={resetForm} variant="ghost">
                  Cancel
                </Button>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="milestone-title">Title</Label>
                  <Input
                    id="milestone-title"
                    onChange={(event) => setTitle(event.target.value)}
                    value={title}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="milestone-summary">Summary</Label>
                  <Textarea
                    id="milestone-summary"
                    onChange={(event) => setSummary(event.target.value)}
                    value={summary}
                  />
                </div>
                <div className="grid gap-3">
                  <Label>Linked user flows</Label>
                  {(userFlowsQuery.data?.userFlows ?? []).length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {(userFlowsQuery.data?.userFlows ?? []).map((flow) => (
                        <Checkbox
                          checked={selectedUseCaseIds.includes(flow.id)}
                          key={flow.id}
                          label={flow.title}
                          onChange={(event) =>
                            setSelectedUseCaseIds((current) =>
                              toggleSelectedFlow(current, flow.id, event.target.checked),
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-secondary">
                      No active user flows are available to link yet.
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    disabled={
                      !canSubmit ||
                      createMilestoneMutation.isPending ||
                      updateMilestoneMutation.isPending
                    }
                    onClick={() => {
                      const payload = {
                        title: title.trim(),
                        summary: summary.trim(),
                        useCaseIds: selectedUseCaseIds,
                      };

                      if (editingMilestoneId) {
                        void updateMilestoneMutation
                          .mutateAsync({ milestoneId: editingMilestoneId, payload })
                          .then(() => {
                            resetForm();
                          })
                          .catch(() => undefined);
                        return;
                      }

                      void createMilestoneMutation
                        .mutateAsync(payload)
                        .then(() => {
                          resetForm();
                        })
                        .catch(() => undefined);
                    }}
                    variant="primary"
                  >
                    {editingMilestoneId ? "Save milestone" : "Create milestone"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
        <Card surface="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="qb-meta-label">Project-level review</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Milestone map review</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                tone={
                  milestoneMapReview.reviewStatus === "passed"
                    ? "success"
                    : milestoneMapReview.reviewStatus === "failed_needs_human"
                      ? "warning"
                      : "neutral"
                }
              >
                {milestoneMapReview.reviewStatus.replaceAll("_", " ")}
              </Badge>
              <Button
                disabled={!milestoneMapReview.generatedAt || reviewMilestoneMapMutation.isPending}
                onClick={() => {
                  void reviewMilestoneMapMutation.mutateAsync().catch(() => undefined);
                }}
                variant="secondary"
              >
                Run Map Review
              </Button>
            </div>
          </div>
          {milestoneMapReview.reviewIssues.length ? (
            <Alert
              tone={
                milestoneMapReview.reviewStatus === "failed_needs_human"
                  ? "error"
                  : "info"
              }
            >
              <ul className="list-disc pl-5 text-sm">
                {milestoneMapReview.reviewIssues.map((issue, index) => (
                  <li key={`map-review-${index}`}>{issue.hint}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </Card>
        <div className="grid gap-4">
          {activeMilestones.map((milestone) => {
            const scopeReviewStatus = milestone.scopeReviewStatus ?? "not_started";
            const scopeReviewIssues = milestone.scopeReviewIssues ?? [];
            const deliveryReviewStatus = milestone.deliveryReviewStatus ?? "not_started";
            const deliveryReviewIssues = milestone.deliveryReviewIssues ?? [];
            const ciStatus = milestone.ciStatus;
            const ciAllowsCompletion =
              !ciStatus || ciStatus.state === "passing" || ciStatus.state === "no_ci";

            return (
            <Card key={milestone.id} surface="panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">Milestone {milestone.position}</Badge>
                    <Badge
                      tone={
                        milestone.status === "completed"
                          ? "success"
                          : milestone.status === "approved"
                            ? "success"
                            : "info"
                      }
                    >
                      {milestone.status}
                    </Badge>
                    {milestone.isActive ? <Badge tone="info">active</Badge> : null}
                    <Badge
                      tone={
                        scopeReviewStatus === "passed"
                          ? "success"
                          : scopeReviewStatus === "failed_needs_human"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      scope review: {scopeReviewStatus.replaceAll("_", " ")}
                    </Badge>
                    <Badge
                      tone={
                        deliveryReviewStatus === "passed"
                          ? "success"
                          : deliveryReviewStatus === "failed_needs_human"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      delivery review: {deliveryReviewStatus.replaceAll("_", " ")}
                    </Badge>
                    {ciStatus ? (
                      <Badge
                        tone={
                          ciStatus.state === "passing" || ciStatus.state === "no_ci"
                            ? "success"
                            : ciStatus.state === "failing"
                              ? "warning"
                              : "info"
                        }
                      >
                        ci: {ciStatus.state.replaceAll("_", " ")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                    {milestone.title}
                  </p>
                  <p className="mt-2 text-sm text-secondary">{milestone.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      openEditPanel(milestone);
                    }}
                    disabled={!milestone.isActive || milestone.status !== "draft"}
                    variant="secondary"
                  >
                    Edit Milestone
                  </Button>
                  <Button
                    aria-expanded={expandedDesignMilestoneId === milestone.id}
                    onClick={() =>
                      setExpandedDesignMilestoneId((current) =>
                        current === milestone.id ? null : milestone.id,
                      )
                    }
                    variant="secondary"
                  >
                    {expandedDesignMilestoneId === milestone.id
                      ? "Hide Milestone Document"
                      : "View Milestone Document"}
                  </Button>
                  {milestone.status === "approved" ? (
                    <Button
                      onClick={() => {
                        void reviewMilestoneScopeMutation.mutateAsync(milestone.id).catch(() => undefined);
                      }}
                      variant="secondary"
                    >
                      Run Scope Review
                    </Button>
                  ) : null}
                  {milestone.status === "draft" ? (
                    <Button
                      onClick={() => {
                        void transitionMilestoneMutation.mutateAsync({
                          milestoneId: milestone.id,
                          action: "approve",
                        }).catch(() => undefined);
                      }}
                      variant="secondary"
                    >
                      Approve
                    </Button>
                  ) : null}
                  {milestone.status === "approved" &&
                  deliveryReviewStatus === "passed" &&
                  ciAllowsCompletion ? (
                    <Button
                      onClick={() => {
                        void transitionMilestoneMutation.mutateAsync({
                          milestoneId: milestone.id,
                          action: "complete",
                        }).catch(() => undefined);
                      }}
                      variant="primary"
                    >
                      Complete
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {milestone.linkedUserFlows.map((flow) => (
                  <Badge key={flow.id} tone="warning">
                    {flow.title}
                  </Badge>
                ))}
                <Badge tone="neutral">{milestone.featureCount} features</Badge>
              </div>
              {scopeReviewIssues.length > 0 ? (
                <Alert tone={scopeReviewStatus === "failed_needs_human" ? "error" : "info"}>
                  <p className="font-medium">
                    Scope review flagged issues in the milestone feature set.
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {scopeReviewIssues.map((issue, index) => (
                      <li key={`${milestone.id}-issue-${index}`}>{issue.hint}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {deliveryReviewIssues.length > 0 ? (
                <Alert tone={deliveryReviewStatus === "failed_needs_human" ? "error" : "info"}>
                  <p className="font-medium">
                    Delivery review flagged downstream workstream or task gaps.
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {deliveryReviewIssues.map((issue, index) => (
                      <li key={`${milestone.id}-delivery-${index}`}>{issue.hint}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {ciStatus && ciStatus.state === "failing" && ciStatus.failures.length > 0 ? (
                <Alert tone="error">
                  <p className="font-medium">Milestone CI is failing.</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {ciStatus.failures.slice(0, 5).map((failure) => (
                      <li key={`${milestone.id}-ci-${failure.id}`}>
                        {failure.name}
                        {failure.summary ? `: ${failure.summary}` : ""}
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {ciStatus && ciStatus.state === "pending" ? (
                <Alert tone="info">
                  Milestone CI checks are still running. Completion stays blocked until they pass.
                </Alert>
              ) : null}
              <MilestoneDesignCard
                isExpanded={expandedDesignMilestoneId === milestone.id}
                jobs={jobsQuery.data?.jobs}
                milestone={milestone}
                projectId={id}
              />
            </Card>
            );
          })}
        </div>
        <Card surface="rail">
          <p className="qb-meta-label">Coverage check</p>
          <div className="mt-4 grid gap-2 text-sm text-secondary">
            <p>
              Covered journeys: {milestonesQuery.data?.coverage.coveredUserFlowCount ?? 0}/
              {milestonesQuery.data?.coverage.approvedUserFlowCount ?? 0}
            </p>
            <p>
              Uncovered journeys: {milestonesQuery.data?.coverage.uncoveredUserFlowIds.length ?? 0}
            </p>
          </div>
        </Card>
      </div>
    </ProjectPageFrame>
  );
};
