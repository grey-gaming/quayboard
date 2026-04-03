import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildImplementationTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Select } from "../components/ui/Select.js";
import { Spinner } from "../components/ui/Spinner.js";
import {
  useMilestonesQuery,
  useProjectQuery,
} from "../hooks/use-projects.js";
import {
  useCancelSandboxRunMutation,
  useCreateSandboxMilestoneSessionMutation,
  useCreateSandboxRunMutation,
  useManagedContainersQuery,
  useSandboxMilestoneSessionsQuery,
  useSandboxOptionsQuery,
  useSandboxRunQuery,
  useSandboxRunsQuery,
  useDisposeManagedContainerMutation,
} from "../hooks/use-sandbox.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { api } from "../lib/api.js";

const statusTone = (status: string) =>
  status === "succeeded"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : status === "running"
        ? "info"
        : "neutral";

export const DevelopPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const milestonesQuery = useMilestonesQuery(id);
  const optionsQuery = useSandboxOptionsQuery(id);
  const runsQuery = useSandboxRunsQuery(id);
  const containersQuery = useManagedContainersQuery(id);
  const createRunMutation = useCreateSandboxRunMutation(id);
  const cancelRunMutation = useCancelSandboxRunMutation(id);
  const disposeContainerMutation = useDisposeManagedContainerMutation(id);

  useSseEvents(id);

  const activeMilestone =
    milestonesQuery.data?.milestones.find((milestone) => milestone.isActive) ?? null;
  const milestoneSessionsQuery = useSandboxMilestoneSessionsQuery(activeMilestone?.id ?? null);
  const createMilestoneSessionMutation = useCreateSandboxMilestoneSessionMutation(
    activeMilestone?.id ?? null,
  );

  const runnableFeatures = optionsQuery.data?.runnableFeatures ?? [];
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [runKind, setRunKind] = useState<"implement" | "verify">("implement");
  const runs = runsQuery.data?.runs ?? [];
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFeatureId && runnableFeatures[0]?.id) {
      setSelectedFeatureId(runnableFeatures[0].id);
    }
  }, [selectedFeatureId, runnableFeatures]);

  useEffect(() => {
    if (!selectedRunId && runs[0]?.id) {
      setSelectedRunId(runs[0].id);
    }
  }, [selectedRunId, runs]);

  const selectedRunQuery = useSandboxRunQuery(selectedRunId);
  const selectedRun = selectedRunQuery.data?.run ?? null;

  const featureTitleById = useMemo(
    () =>
      new Map(
        runnableFeatures.map((feature) => [feature.id, `${feature.featureKey} ${feature.title}`]),
      ),
    [runnableFeatures],
  );

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  return (
    <ProjectPageFrame
      activeSection="implementation"
      project={projectQuery.data}
      tertiaryItems={buildImplementationTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Implementation"
        title="Develop"
        summary="Launch feature implementation runs, inspect execution evidence, manage active containers, and orchestrate the active milestone delivery sequence."
        meta={
          <>
            <Badge tone="neutral">{runs.length} runs</Badge>
            <Badge tone="neutral">
              {containersQuery.data?.containers.length ?? 0} containers
            </Badge>
          </>
        }
      />

      {optionsQuery.error || runsQuery.error || containersQuery.error || milestoneSessionsQuery.error ? (
        <Alert tone="error">
          Failed to load some execution data. Refresh the page or retry once the API is healthy.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_22rem]">
        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="qb-meta-label">Run Launcher</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Start a sandbox run</p>
                <p className="mt-2 text-sm text-secondary">
                  The runner uses the project&apos;s verified repository, the saved sandbox limits,
                  and the latest coding context pack for the selected feature.
                </p>
              </div>
              <Link className="text-sm text-accent hover:underline" to="/settings/execution">
                Execution settings
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="qb-meta-label" htmlFor="run-feature">
                  Feature
                </label>
                <Select
                  id="run-feature"
                  onChange={(event) => setSelectedFeatureId(event.target.value)}
                  value={selectedFeatureId}
                >
                  {runnableFeatures.map((feature) => (
                    <option key={feature.id} value={feature.id}>
                      {feature.featureKey} {feature.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="qb-meta-label" htmlFor="run-kind">
                  Run Kind
                </label>
                <Select
                  id="run-kind"
                  onChange={(event) => setRunKind(event.target.value as "implement" | "verify")}
                  value={runKind}
                >
                  <option value="implement">Implement</option>
                  <option value="verify">Verify</option>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                disabled={!selectedFeatureId || createRunMutation.isPending}
                onClick={() => {
                  createRunMutation.mutate(
                    { featureId: selectedFeatureId, kind: runKind },
                    {
                      onSuccess: (run) => {
                        setSelectedRunId(run.id);
                      },
                    },
                  );
                }}
                variant="primary"
              >
                {createRunMutation.isPending ? "Queueing..." : "Queue run"}
              </Button>
              {optionsQuery.data?.projectRepo ? (
                <p className="text-sm text-secondary">
                  Repo: {optionsQuery.data.projectRepo.owner}/{optionsQuery.data.projectRepo.name}
                </p>
              ) : (
                <p className="text-sm text-secondary">No verified repository available.</p>
              )}
            </div>
            {runnableFeatures.length === 0 ? (
              <Alert className="mt-4" tone="info">
                No runnable features yet. Approve milestone features, generate task plans, and
                ensure the project repository is verified before queueing a run.
              </Alert>
            ) : null}
          </Card>

          <Card surface="panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="qb-meta-label">Runs</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Execution history</p>
              </div>
              {runsQuery.isLoading ? <Spinner /> : null}
            </div>
            <div className="mt-4 grid gap-3">
              {runs.length === 0 ? (
                <p className="text-sm text-secondary">
                  No sandbox runs yet. Queue a feature run to start implementation or verification.
                </p>
              ) : (
                runs.map((run) => (
                  <button
                    key={run.id}
                    className={[
                      "grid gap-2 border border-border/70 bg-panel-inset p-4 text-left",
                      selectedRunId === run.id ? "border-accent/60" : "",
                    ].join(" ")}
                    onClick={() => setSelectedRunId(run.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {run.featureId ? featureTitleById.get(run.featureId) ?? run.featureId : run.id}
                      </p>
                      <Badge tone={statusTone(run.status) as never}>{run.status}</Badge>
                    </div>
                    <p className="text-xs uppercase tracking-[0.12em] text-secondary">
                      {run.kind} · {run.outcome ?? "pending"}
                    </p>
                    <p className="text-xs text-secondary">
                      {run.latestEvent?.message ?? "No events yet."}
                    </p>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card surface="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="qb-meta-label">Selected Run</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  {selectedRun ? selectedRun.id : "No run selected"}
                </p>
              </div>
              {selectedRun &&
              (selectedRun.status === "queued" || selectedRun.status === "running") ? (
                <Button
                  disabled={cancelRunMutation.isPending}
                  onClick={() => cancelRunMutation.mutate({ runId: selectedRun.id })}
                  variant="secondary"
                >
                  Cancel run
                </Button>
              ) : null}
            </div>
            {!selectedRunId ? (
              <p className="mt-4 text-sm text-secondary">Select a run to inspect its events and artifacts.</p>
            ) : selectedRunQuery.isLoading ? (
              <div className="mt-4 flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : selectedRunQuery.error ? (
              <Alert tone="error">Failed to load run details.</Alert>
            ) : selectedRun ? (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="qb-kv">
                    <p className="qb-meta-label">Status</p>
                    <p className="text-sm text-foreground">{selectedRun.status}</p>
                  </div>
                  <div className="qb-kv">
                    <p className="qb-meta-label">Outcome</p>
                    <p className="text-sm text-foreground">{selectedRun.outcome ?? "pending"}</p>
                  </div>
                  <div className="qb-kv">
                    <p className="qb-meta-label">Base SHA</p>
                    <p className="text-sm text-foreground">{selectedRun.baseCommitSha ?? "n/a"}</p>
                  </div>
                  <div className="qb-kv">
                    <p className="qb-meta-label">Head SHA</p>
                    <p className="text-sm text-foreground">{selectedRun.headCommitSha ?? "n/a"}</p>
                  </div>
                  <div className="qb-kv">
                    <p className="qb-meta-label">PR</p>
                    <p className="text-sm text-foreground">
                      {selectedRun.pullRequestUrl ? (
                        <a
                          className="text-accent hover:underline"
                          href={selectedRun.pullRequestUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open pull request
                        </a>
                      ) : (
                        "Not created"
                      )}
                    </p>
                  </div>
                  <div className="qb-kv">
                    <p className="qb-meta-label">Context Pack</p>
                    <p className="text-sm text-foreground">{selectedRun.contextPackId ?? "n/a"}</p>
                  </div>
                </div>
                <div>
                  <p className="qb-meta-label">Events</p>
                  <div className="mt-2 grid gap-2">
                    {selectedRunQuery.data?.events.map((event) => (
                      <div
                        key={event.id}
                        className="border border-border/70 bg-panel-inset px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{event.message}</p>
                          <Badge tone={statusTone(event.level) as never}>{event.level}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-secondary">{event.type}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="qb-meta-label">Artifacts</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedRun.artifacts.map((artifact) => (
                      <a
                        key={artifact.name}
                        className="inline-flex min-h-10 items-center border border-border/70 px-3 py-2 text-sm text-foreground hover:border-accent/50"
                        href={api.getSandboxRunArtifactUrl(selectedRun.id, artifact.name)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {artifact.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="grid gap-4">
          <Card surface="panel">
            <p className="qb-meta-label">Milestone Sessions</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
              {activeMilestone ? activeMilestone.title : "No active milestone"}
            </p>
            {activeMilestone ? (
              <>
                <Button
                  className="mt-4"
                  disabled={createMilestoneSessionMutation.isPending}
                  onClick={() => createMilestoneSessionMutation.mutate()}
                  variant="secondary"
                >
                  {createMilestoneSessionMutation.isPending
                    ? "Starting..."
                    : "Start milestone session"}
                </Button>
                <div className="mt-4 grid gap-3">
                  {(milestoneSessionsQuery.data?.sessions ?? []).map((session) => (
                    <div
                      key={session.id}
                      className="border border-border/70 bg-panel-inset px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{session.id}</p>
                        <Badge tone={statusTone(session.status) as never}>{session.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-secondary">
                        {session.tasks.length} feature run{session.tasks.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-secondary">
                Approve and activate a milestone before starting milestone execution.
              </p>
            )}
          </Card>

          <Card surface="panel">
            <p className="qb-meta-label">Managed Containers</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Container lifecycle</p>
            <div className="mt-4 grid gap-3">
              {(containersQuery.data?.containers ?? []).length === 0 ? (
                <p className="text-sm text-secondary">No managed containers found for this project.</p>
              ) : (
                containersQuery.data!.containers.map((container) => (
                  <div
                    key={container.id}
                    className="border border-border/70 bg-panel-inset px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{container.name ?? container.id}</p>
                      <Badge tone={statusTone(container.state) as never}>{container.state}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-secondary">{container.image}</p>
                    <Button
                      className="mt-3"
                      disabled={disposeContainerMutation.isPending}
                      onClick={() => disposeContainerMutation.mutate(container.id)}
                      variant="ghost"
                    >
                      Dispose
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </ProjectPageFrame>
  );
};
