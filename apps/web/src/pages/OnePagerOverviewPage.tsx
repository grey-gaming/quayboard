import { useEffect, useMemo, useRef } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

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
import {
  useApproveOnePagerMutation,
  useGenerateOnePagerMutation,
  useOnePagerQuery,
  useOnePagerVersionsQuery,
  useProjectJobsQuery,
  useProjectQuery,
  useQuestionnaireQuery,
  useRestoreOnePagerMutation,
  useUpdateOnePagerMutation,
} from "../hooks/use-projects.js";
import { useJobDrivenRefresh } from "../hooks/use-job-driven-refresh.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

type NavigationState = {
  questionnaireCompleted?: boolean;
  startGeneration?: boolean;
};

const overviewJobTypes = new Set([
  "GenerateProjectOverview",
  "RegenerateProjectOverview",
  "GenerateOverviewImprovements",
]);

export const OnePagerOverviewPage = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as NavigationState | null;
  const projectQuery = useProjectQuery(id);
  const questionnaireQuery = useQuestionnaireQuery(id);
  const onePagerQuery = useOnePagerQuery(id);
  const versionsQuery = useOnePagerVersionsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const generateOnePagerMutation = useGenerateOnePagerMutation(id);
  const approveOnePagerMutation = useApproveOnePagerMutation(id);
  const restoreOnePagerMutation = useRestoreOnePagerMutation(id);
  const updateOnePagerMutation = useUpdateOnePagerMutation(id);
  const hasTriggeredGenerationRef = useRef(false);

  useSseEvents(id);

  const questionnaireReady =
    navigationState?.questionnaireCompleted || Boolean(questionnaireQuery.data?.completedAt);
  const activeOverviewJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          overviewJobTypes.has(job.type) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const latestOverviewJob = useMemo(
    () => findLatestJob(jobsQuery.data?.jobs, (job) => overviewJobTypes.has(job.type)),
    [jobsQuery.data?.jobs],
  );
  const latestFailedOverviewJob = useMemo(
    () => findLatestFailedJob(jobsQuery.data?.jobs, (job) => overviewJobTypes.has(job.type)),
    [jobsQuery.data?.jobs],
  );
  const redirectedFromLockedSection =
    typeof location.state === "object" &&
    location.state !== null &&
    "lockedFromPath" in location.state &&
    typeof location.state.lockedFromPath === "string"
      ? location.state.lockedFromPath
      : null;
  const generationMode = onePagerQuery.data?.onePager ? "regenerate" : "generate";
  const activeError =
    questionnaireQuery.error ||
    onePagerQuery.error ||
    versionsQuery.error ||
    jobsQuery.error ||
    generateOnePagerMutation.error ||
    approveOnePagerMutation.error ||
    restoreOnePagerMutation.error ||
    updateOnePagerMutation.error;

  useEffect(() => {
    if (!navigationState?.startGeneration || hasTriggeredGenerationRef.current || !questionnaireReady) {
      return;
    }

    hasTriggeredGenerationRef.current = true;
    navigate(location.pathname, { replace: true, state: null });

    if (!activeOverviewJob) {
      void generateOnePagerMutation.mutateAsync(generationMode);
    }
  }, [
    activeOverviewJob,
    generateOnePagerMutation,
    generationMode,
    location.pathname,
    navigate,
    navigationState?.startGeneration,
    questionnaireReady,
  ]);

  useJobDrivenRefresh({
    active: Boolean(activeOverviewJob),
    latestJob: latestOverviewJob,
    queryKeys: [
      ["project", id, "one-pager"],
      ["project", id, "one-pager-versions"],
    ],
  });

  if (questionnaireQuery.data && !questionnaireReady && !navigationState?.startGeneration) {
    return <Navigate replace to={`/projects/${id}/questions`} />;
  }

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  const overviewButtonActive = generateOnePagerMutation.isPending || Boolean(activeOverviewJob);

  return (
    <ProjectPageFrame
      activeSection="product-design"
      project={projectQuery.data}
      tertiaryItems={buildProductDesignTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Overview"
        title="Generated Overview"
        summary="This page turns the saved questionnaire into the working overview document. Regenerate it when needed, inspect history, and approve the version that should guide the next stage."
        meta={
          <>
            <Badge tone={questionnaireReady ? "success" : "warning"}>
              {questionnaireReady ? "questionnaire complete" : "questionnaire required"}
            </Badge>
            <Badge tone={onePagerQuery.data?.onePager ? "success" : "warning"}>
              {onePagerQuery.data?.onePager ? "overview present" : "overview pending"}
            </Badge>
          </>
        }
      />

      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}
      {redirectedFromLockedSection ? (
        <Alert tone="info">
          Approve the overview on this page to continue to the next stage. You were redirected from{" "}
          <span className="font-mono">{redirectedFromLockedSection}</span>.
        </Alert>
      ) : null}
      {activeOverviewJob ? (
        <Alert tone="info">
          Overview generation is {activeOverviewJob.status}. The page will refresh automatically
          when the job completes.
        </Alert>
      ) : null}
      {!activeOverviewJob ? (
        <LatestJobFailureAlert
          currentVersionStillAvailable={Boolean(onePagerQuery.data?.onePager)}
          hint={
            latestFailedOverviewJob && getJobErrorMessage(latestFailedOverviewJob)
              ? getDefaultJobFailureHint(
                  getJobErrorMessage(latestFailedOverviewJob)!,
                  "Overview generation",
                )
              : null
          }
          job={latestFailedOverviewJob}
          workflowLabel="Overview generation"
        />
      ) : null}

      <div className="grid gap-4">
        <Card surface="panel">
          <div className="flex flex-wrap justify-end gap-2 border-b border-border/80 pb-4">
            <div className="flex flex-wrap gap-2">
              <AiWorkflowButton
                active={overviewButtonActive}
                disabled={!questionnaireReady || overviewButtonActive}
                label={onePagerQuery.data?.onePager ? "Regenerate Overview" : "Generate Overview"}
                onClick={() => {
                  void generateOnePagerMutation.mutateAsync(generationMode);
                }}
                runningLabel="Generating Overview"
                type="button"
                variant="secondary"
              />
              <Button
                disabled={!onePagerQuery.data?.onePager || approveOnePagerMutation.isPending}
                onClick={() => {
                  void approveOnePagerMutation.mutateAsync();
                }}
                type="button"
                variant="secondary"
              >
                Approve Overview
              </Button>
            </div>
          </div>
          <div className="mt-4 min-w-0 overflow-hidden border border-border/80 bg-panel px-4 py-4">
            {onePagerQuery.data?.onePager ? (
              <EditableMarkdownDocument
                disabled={Boolean(activeOverviewJob)}
                isSaving={updateOnePagerMutation.isPending}
                markdown={onePagerQuery.data.onePager.markdown}
                onSave={(markdown) => updateOnePagerMutation.mutateAsync({ markdown })}
                saveLabel="Save Overview"
              />
            ) : activeOverviewJob || latestOverviewJob ? (
              <p className="text-sm text-secondary">
                The overview is being prepared. Stay on this page to review it when the job
                finishes.
              </p>
            ) : (
              <p className="text-sm text-secondary">
                No overview has been generated yet. Generate the overview from the questions page
                or from this screen.
              </p>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card surface="rail">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">History</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Overview Versions</p>
              </div>
              <Badge tone="neutral">{versionsQuery.data?.versions.length ?? 0} versions</Badge>
            </div>
            <div className="mt-4 grid gap-0 border border-border/80">
              {versionsQuery.data?.versions.length ? (
                versionsQuery.data.versions.map((version) => (
                  <div
                    key={version.id}
                    className="grid gap-2 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Version {version.version} {version.isCanonical ? "(canonical)" : ""}
                        </p>
                        <p className="qb-meta-label">{formatDateTime(version.createdAt)}</p>
                      </div>
                      <Button
                        disabled={restoreOnePagerMutation.isPending}
                        onClick={() => {
                          void restoreOnePagerMutation.mutateAsync(version.version);
                        }}
                        type="button"
                        variant="ghost"
                      >
                        Restore
                      </Button>
                    </div>
                    <p className="text-sm text-secondary">
                      {version.approvedAt
                        ? `approved ${formatDateTime(version.approvedAt)}`
                        : "awaiting approval"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="bg-panel-inset px-4 py-4 text-sm text-secondary">
                  No overview versions yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </ProjectPageFrame>
  );
};
