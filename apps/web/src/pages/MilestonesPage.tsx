import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Job } from "@quayboard/shared";

import { MarkdownDocument } from "../components/composites/MarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { buildProductDesignTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import {
  findLatestFailedJob,
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
import { Select } from "../components/ui/Select.js";
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
  useTransitionMilestoneMutation,
  useUpdateMilestoneMutation,
  useUserFlowsQuery,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const readSelectedValues = (select: HTMLSelectElement) =>
  [...select.selectedOptions].map((option) => option.value);

const isActiveJob = (job: Job) => job.status === "queued" || job.status === "running";
const jobTargetsMilestone = (job: Job, milestoneId: string) =>
  typeof job.inputs === "object" &&
  job.inputs !== null &&
  "milestoneId" in job.inputs &&
  job.inputs.milestoneId === milestoneId;

export const MilestonesPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const userFlowsQuery = useUserFlowsQuery(id);
  const milestonesQuery = useMilestonesQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const createMilestoneMutation = useCreateMilestoneMutation(id);
  const updateMilestoneMutation = useUpdateMilestoneMutation(id);
  const transitionMilestoneMutation = useTransitionMilestoneMutation(id);
  const generateMilestonesMutation = useGenerateMilestonesMutation(id);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("");
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedUseCaseIds, setSelectedUseCaseIds] = useState<string[]>([]);

  useSseEvents(id);

  const selectedMilestone =
    milestonesQuery.data?.milestones.find((milestone) => milestone.id === selectedMilestoneId) ??
    milestonesQuery.data?.milestones[0] ??
    null;
  const designDocsQuery = useMilestoneDesignDocsQuery(selectedMilestone?.id ?? null);
  const generateDesignMutation = useGenerateMilestoneDesignMutation(id, selectedMilestone?.id ?? "");
  const approveDesignMutation = useApproveMilestoneDesignMutation(id, selectedMilestone?.id ?? "");

  const resetForm = () => {
    setEditingMilestoneId(null);
    setTitle("");
    setSummary("");
    setSelectedUseCaseIds([]);
  };

  const activeMilestones = milestonesQuery.data?.milestones ?? [];

  const canSubmit = title.trim() && summary.trim() && selectedUseCaseIds.length > 0;

  const linkedFlowTitles = useMemo(
    () => new Set(selectedMilestone?.linkedUserFlows.map((flow) => flow.title) ?? []),
    [selectedMilestone?.linkedUserFlows],
  );
  const activeMilestonePlanJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) => job.type === "GenerateMilestones" && isActiveJob(job),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const latestFailedMilestonePlanJob = useMemo(
    () => findLatestFailedJob(jobsQuery.data?.jobs, (job) => job.type === "GenerateMilestones"),
    [jobsQuery.data?.jobs],
  );
  const activeMilestoneDesignJob = useMemo(
    () =>
      selectedMilestone
        ? jobsQuery.data?.jobs.find(
            (job) =>
              job.type === "GenerateMilestoneDesign" &&
              jobTargetsMilestone(job, selectedMilestone.id) &&
              isActiveJob(job),
          ) ?? null
        : null,
    [jobsQuery.data?.jobs, selectedMilestone],
  );
  const latestFailedMilestoneDesignJob = useMemo(
    () =>
      selectedMilestone
        ? findLatestFailedJob(
            jobsQuery.data?.jobs,
            (job) =>
              job.type === "GenerateMilestoneDesign" &&
              jobTargetsMilestone(job, selectedMilestone.id),
          )
        : null,
    [jobsQuery.data?.jobs, selectedMilestone],
  );
  const activeError =
    projectQuery.error ||
    userFlowsQuery.error ||
    milestonesQuery.error ||
    jobsQuery.error ||
    designDocsQuery.error ||
    createMilestoneMutation.error ||
    updateMilestoneMutation.error ||
    transitionMilestoneMutation.error ||
    generateMilestonesMutation.error ||
    generateDesignMutation.error ||
    approveDesignMutation.error;
  const milestonePlanButtonActive =
    generateMilestonesMutation.isPending || Boolean(activeMilestonePlanJob);
  const milestoneDesignButtonActive =
    generateDesignMutation.isPending || Boolean(activeMilestoneDesignJob);

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
        actions={
          <AiWorkflowButton
            active={milestonePlanButtonActive}
            disabled={milestonePlanButtonActive || activeMilestones.length > 0}
            label="Generate Milestones"
            onClick={() => {
              void generateMilestonesMutation.mutateAsync();
            }}
            runningLabel="Generating milestones..."
          />
        }
        eyebrow="Milestones"
        title="Milestones"
        summary="Plan releasable increments from the approved user-flow contract, then generate and approve a design document for each approved milestone."
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
          <div className="grid gap-4">
            <Card surface="panel">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">Milestone intake</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {editingMilestoneId ? "Edit milestone" : "Create milestone"}
                  </p>
                </div>
                {editingMilestoneId ? (
                  <Button onClick={resetForm} variant="ghost">
                    Cancel edit
                  </Button>
                ) : null}
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
                <div className="grid gap-2">
                  <Label htmlFor="milestone-flows">Linked user flows</Label>
                  <Select
                    id="milestone-flows"
                    multiple
                    onChange={(event) => setSelectedUseCaseIds(readSelectedValues(event.target))}
                    value={selectedUseCaseIds}
                  >
                    {(userFlowsQuery.data?.userFlows ?? []).map((flow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.title}
                      </option>
                    ))}
                  </Select>
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
                          });
                        return;
                      }

                      void createMilestoneMutation.mutateAsync(payload).then(() => {
                        resetForm();
                      });
                    }}
                    variant="primary"
                  >
                    {editingMilestoneId ? "Save milestone" : "Create milestone"}
                  </Button>
                </div>
              </div>
            </Card>
            <div className="grid gap-4">
              {activeMilestones.map((milestone) => (
                <Card key={milestone.id} surface="panel">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">Milestone {milestone.position}</Badge>
                        <Badge tone={milestone.status === "completed" ? "success" : "info"}>
                          {milestone.status}
                        </Badge>
                      </div>
                      <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                        {milestone.title}
                      </p>
                      <p className="mt-2 text-sm text-secondary">{milestone.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          setEditingMilestoneId(milestone.id);
                          setTitle(milestone.title);
                          setSummary(milestone.summary);
                          setSelectedUseCaseIds(milestone.linkedUserFlows.map((flow) => flow.id));
                        }}
                        variant="ghost"
                      >
                        Edit
                      </Button>
                      {milestone.status === "draft" ? (
                        <Button
                          onClick={() => {
                            void transitionMilestoneMutation.mutateAsync({
                              milestoneId: milestone.id,
                              action: "approve",
                            });
                          }}
                          variant="secondary"
                        >
                          Approve
                        </Button>
                      ) : null}
                      {milestone.status === "approved" ? (
                        <Button
                          onClick={() => {
                            void transitionMilestoneMutation.mutateAsync({
                              milestoneId: milestone.id,
                              action: "complete",
                            });
                          }}
                          variant="secondary"
                        >
                          Complete
                        </Button>
                      ) : null}
                      <Button
                        onClick={() => setSelectedMilestoneId(milestone.id)}
                        variant="ghost"
                      >
                        Design doc
                      </Button>
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
                </Card>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            {activeMilestoneDesignJob ? (
              <Alert tone="info">
                Milestone design doc generation is {activeMilestoneDesignJob.status}. The selected
                milestone will refresh automatically when the job completes.
              </Alert>
            ) : null}
            {!activeMilestoneDesignJob ? (
              <LatestJobFailureAlert
                currentVersionStillAvailable={Boolean(designDocsQuery.data?.designDocs[0])}
                hint={
                  latestFailedMilestoneDesignJob &&
                  getJobErrorMessage(latestFailedMilestoneDesignJob)
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
            <Card surface="rail">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="qb-meta-label">Design doc</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {selectedMilestone?.title ?? "Select a milestone"}
                  </p>
                </div>
                {selectedMilestone?.status === "approved" ? (
                  <AiWorkflowButton
                    active={milestoneDesignButtonActive}
                    label="Generate"
                    onClick={() => {
                      if (!selectedMilestone) {
                        return;
                      }
                      void generateDesignMutation.mutateAsync();
                    }}
                    runningLabel="Generating..."
                    disabled={milestoneDesignButtonActive}
                    variant="secondary"
                  />
                ) : null}
              </div>
              <div className="mt-4 text-sm text-secondary">
                {(selectedMilestone?.linkedUserFlows ?? []).length === 0 ? (
                  <p>Select an approved milestone to generate and review its design doc.</p>
                ) : (
                  <p>
                    Linked journeys:{" "}
                    {[...(selectedMilestone?.linkedUserFlows ?? [])]
                      .map((flow) => flow.title)
                      .join(", ")}
                  </p>
                )}
              </div>
            </Card>
            <Card surface="panel">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">Current revision</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {designDocsQuery.data?.designDocs[0]?.title ?? "No design doc yet"}
                  </p>
                </div>
                {designDocsQuery.data?.designDocs[0] &&
                !designDocsQuery.data.designDocs[0].approval &&
                selectedMilestone?.status === "approved" ? (
                  <Button
                    onClick={() => {
                      void approveDesignMutation.mutateAsync(designDocsQuery.data!.designDocs[0].id);
                    }}
                    variant="secondary"
                  >
                    Approve design doc
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3">
                {designDocsQuery.data?.designDocs[0] ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {designDocsQuery.data.designDocs[0].approval ? (
                        <Badge tone="success">approved</Badge>
                      ) : (
                        <Badge tone="warning">approval required</Badge>
                      )}
                      <Badge tone="neutral">
                        linked flows covered: {selectedMilestone?.linkedUserFlows.length ?? 0}
                      </Badge>
                    </div>
                    <MarkdownDocument markdown={designDocsQuery.data.designDocs[0].markdown} />
                  </>
                ) : (
                  <p className="text-sm text-secondary">
                    No milestone design doc exists for the selected milestone yet.
                  </p>
                )}
              </div>
            </Card>
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
                {selectedMilestone ? (
                  <p>
                    Selected milestone overlap: {selectedMilestone.linkedUserFlows.filter((flow) =>
                      linkedFlowTitles.has(flow.title),
                    ).length}
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ProjectPageFrame>
  );
};
