import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { EditableMarkdownDocument } from "../components/composites/EditableMarkdownDocument.js";
import { buildFeatureBuilderTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import {
  findLatestFailedJob,
  findLatestJob,
  getDefaultJobFailureHint,
  getJobErrorMessage,
  LatestJobFailureAlert,
} from "../components/workflow/LatestJobFailureAlert.js";
import { NextActionBar } from "../components/workflow/NextActionBar.js";
import { ReviewPanel } from "../components/workflow/ReviewPanel.js";
import { Alert } from "../components/ui/Alert.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Checkbox } from "../components/ui/Checkbox.js";
import { Label } from "../components/ui/Label.js";
import { Select } from "../components/ui/Select.js";
import {
  useAddFeatureDependencyMutation,
  useApproveFeatureWorkstreamRevisionMutation,
  useArchiveFeatureMutation,
  useCreateFeatureWorkstreamRevisionMutation,
  useFeaturesQuery,
  useFeatureQuery,
  useFeatureTracksQuery,
  useFeatureWorkstreamRevisionsQuery,
  useGenerateFeatureWorkstreamRevisionMutation,
  useProjectJobsQuery,
  useProjectQuery,
  useRemoveFeatureDependencyMutation,
  useUpdateFeatureMutation,
} from "../hooks/use-projects.js";
import { useJobDrivenRefresh } from "../hooks/use-job-driven-refresh.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const tabKinds = ["product", "ux", "tech", "user_docs", "arch_docs", "tasks"] as const;
type TabKind = (typeof tabKinds)[number];

const kindLabels: Record<Exclude<TabKind, "tasks">, string> = {
  product: "Product",
  ux: "UX",
  tech: "Tech",
  user_docs: "User Docs",
  arch_docs: "Arch Docs",
};

const generationJobTypes = {
  product: "GenerateFeatureProductSpec",
  ux: "GenerateFeatureUxSpec",
  tech: "GenerateFeatureTechSpec",
  user_docs: "GenerateFeatureUserDocs",
  arch_docs: "GenerateFeatureArchDocs",
} as const;

const toFilename = (featureKey: string, kind: string) =>
  `${featureKey.toLowerCase()}-${kind.replaceAll("_", "-")}.md`;

const defaultRequirements = {
  uxRequired: true,
  techRequired: true,
  userDocsRequired: true,
  archDocsRequired: true,
};
const priorities = ["must_have", "should_have", "could_have", "wont_have"] as const;
const statuses = ["draft", "approved", "in_progress", "completed"] as const;

export const FeatureEditorPage = () => {
  const { id = "", featureId = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const featureQuery = useFeatureQuery(featureId);
  const featuresQuery = useFeaturesQuery(id);
  const tracksQuery = useFeatureTracksQuery(featureId);
  const jobsQuery = useProjectJobsQuery(id);
  const addDependencyMutation = useAddFeatureDependencyMutation(id);
  const archiveFeatureMutation = useArchiveFeatureMutation(id);
  const createRevisionMutation = useCreateFeatureWorkstreamRevisionMutation(id);
  const generateRevisionMutation = useGenerateFeatureWorkstreamRevisionMutation(id);
  const approveRevisionMutation = useApproveFeatureWorkstreamRevisionMutation(id);
  const removeDependencyMutation = useRemoveFeatureDependencyMutation(id);
  const updateFeatureMutation = useUpdateFeatureMutation(id);

  useSseEvents(id);

  const visibleTabs = useMemo(() => {
    const tracks = tracksQuery.data?.tracks;

    return tabKinds.filter((kind) => {
      if (kind === "tasks") {
        return true;
      }

      if (kind === "product") {
        return true;
      }

      if (!tracks) {
        return false;
      }

      return (
        (kind === "ux" && tracks.ux.required) ||
        (kind === "tech" && tracks.tech.required) ||
        (kind === "user_docs" && tracks.userDocs.required) ||
        (kind === "arch_docs" && tracks.archDocs.required)
      );
    });
  }, [tracksQuery.data?.tracks]);

  const [activeTab, setActiveTab] = useState<TabKind>("product");
  const [pendingDependencyId, setPendingDependencyId] = useState("");

  const resolvedTab = visibleTabs.includes(activeTab) ? activeTab : (visibleTabs[0] ?? "product");
  const activeKind = resolvedTab === "tasks" ? null : resolvedTab;
  const revisionsQuery = useFeatureWorkstreamRevisionsQuery(
    featureId,
    activeKind ?? "product",
  );
  const revisions = revisionsQuery.data?.revisions ?? [];
  const headRevision = revisions[0] ?? null;
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const currentRevision =
    revisions.find((revision) => revision.id === selectedRevisionId) ?? headRevision;
  const isViewingHeadRevision = Boolean(
    !currentRevision || (headRevision && currentRevision.id === headRevision.id),
  );
  const activeTrack =
    activeKind === "product"
      ? tracksQuery.data?.tracks.product
      : activeKind === "ux"
        ? tracksQuery.data?.tracks.ux
        : activeKind === "tech"
          ? tracksQuery.data?.tracks.tech
          : activeKind === "user_docs"
            ? tracksQuery.data?.tracks.userDocs
            : activeKind === "arch_docs"
              ? tracksQuery.data?.tracks.archDocs
              : null;
  const [requirements, setRequirements] = useState(
    currentRevision?.requirements ?? defaultRequirements,
  );
  const dependencyOptions = useMemo(
    () =>
      (featuresQuery.data?.features ?? []).filter(
        (feature) =>
          feature.id !== featureId && !featureQuery.data?.dependencyIds.includes(feature.id),
      ),
    [featureId, featureQuery.data?.dependencyIds, featuresQuery.data?.features],
  );
  const dependencyTitleById = useMemo(
    () =>
      new Map(
        (featuresQuery.data?.features ?? []).map((feature) => [
          feature.id,
          `${feature.featureKey} ${feature.headRevision.title}`,
        ]),
      ),
    [featuresQuery.data?.features],
  );
  const featureTertiaryItems = useMemo(() => {
    if (!projectQuery.data) {
      return [];
    }

    const items = [...buildFeatureBuilderTertiaryItems(projectQuery.data)];

    if (!featureQuery.data) {
      return items;
    }

    items.push({
      kind: "label",
      key: "feature-title",
      label: featureQuery.data.headRevision.title,
      title: featureQuery.data.headRevision.title,
      truncate: true,
    });

    for (const kind of visibleTabs) {
      items.push({
        kind: "button",
        key: kind,
        label: kind === "tasks" ? "Tasks" : kindLabels[kind],
        active: resolvedTab === kind,
        onClick: () => {
          setActiveTab(kind);
        },
      });
    }

    return items;
  }, [featureQuery.data, projectQuery.data, resolvedTab, visibleTabs]);

  useEffect(() => {
    if (!revisions.length) {
      setSelectedRevisionId(null);
      return;
    }

    setSelectedRevisionId((current) =>
      current && revisions.some((revision) => revision.id === current) ? current : revisions[0]!.id,
    );
  }, [activeKind, revisions]);

  useEffect(() => {
    setRequirements(currentRevision?.requirements ?? defaultRequirements);
  }, [currentRevision?.id, currentRevision?.requirements]);

  const activeJob =
    activeKind && jobsQuery.data?.jobs
      ? jobsQuery.data.jobs.find(
          (job) =>
            job.type === generationJobTypes[activeKind] &&
            (job.status === "queued" || job.status === "running") &&
            typeof job.inputs === "object" &&
            job.inputs !== null &&
            "featureId" in job.inputs &&
            job.inputs.featureId === featureId,
        ) ?? null
      : null;
  const latestFailedJob =
    activeKind && jobsQuery.data?.jobs
      ? findLatestFailedJob(
          jobsQuery.data.jobs,
          (job) =>
            job.type === generationJobTypes[activeKind] &&
            typeof job.inputs === "object" &&
            job.inputs !== null &&
            "featureId" in job.inputs &&
            job.inputs.featureId === featureId,
        )
      : null;
  const latestJob =
    activeKind && jobsQuery.data?.jobs
      ? findLatestJob(
          jobsQuery.data.jobs,
          (job) =>
            job.type === generationJobTypes[activeKind] &&
            typeof job.inputs === "object" &&
            job.inputs !== null &&
            "featureId" in job.inputs &&
            job.inputs.featureId === featureId,
        )
      : null;

  useJobDrivenRefresh({
    active: Boolean(activeJob),
    latestJob,
    queryKeys:
      activeKind === null
        ? []
        : [
            ["feature", featureId, "tracks"],
            ["feature", featureId, `${activeKind}-revisions`],
          ],
  });

  const saveRevision = async (markdown: string) => {
    if (!activeKind) {
      return;
    }

    if (activeKind === "product") {
      await createRevisionMutation.mutateAsync({
        featureId,
        kind: activeKind,
        payload: {
          markdown,
          requirements,
          source: "manual",
        },
      });
      return;
    }

    await createRevisionMutation.mutateAsync({
      featureId,
      kind: activeKind,
      payload: {
        markdown,
        source: "manual",
      },
    });
  };

  const downloadMarkdown = () => {
    if (!activeKind || !currentRevision || !featureQuery.data) {
      return;
    }

    const blob = new Blob([currentRevision.markdown], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = toFilename(featureQuery.data.featureKey, activeKind);
    anchor.click();
    URL.revokeObjectURL(href);
  };

  if (featureQuery.data && featureQuery.data.projectId !== id) {
    return <Navigate replace to={`/projects/${featureQuery.data.projectId}/features/${featureId}`} />;
  }

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  return (
    <ProjectPageFrame
      activeSection="feature-design"
      project={projectQuery.data}
      tertiaryItems={featureTertiaryItems}
    >
      <PageIntro
        eyebrow="Features"
        title={featureQuery.data?.headRevision.title ?? "Feature Editor"}
        summary={
          featureQuery.data?.headRevision.summary ??
          "Draft, generate, and approve each feature workstream before task planning begins."
        }
        meta={
          <>
            {featureQuery.data ? <Badge tone="neutral">{featureQuery.data.featureKey}</Badge> : null}
            {featureQuery.data ? (
              <Badge tone="neutral">{featureQuery.data.milestoneTitle}</Badge>
            ) : null}
            <Badge tone="warning">Not implemented yet</Badge>
          </>
        }
      />

      {activeKind && !activeJob ? (
        <LatestJobFailureAlert
          currentVersionStillAvailable={Boolean(headRevision)}
          hint={
            latestFailedJob && getJobErrorMessage(latestFailedJob)
              ? getDefaultJobFailureHint(
                  getJobErrorMessage(latestFailedJob)!,
                  `${kindLabels[activeKind]} generation`,
                )
              : null
          }
          job={latestFailedJob}
          workflowLabel={`${kindLabels[activeKind]} generation`}
        />
      ) : null}
      {activeKind && activeJob ? (
        <Alert tone="info">
          {kindLabels[activeKind]} generation is {activeJob.status}. The editor will refresh when
          the job completes.
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {resolvedTab === "tasks" ? (
          <Card surface="panel">
            <div className="grid gap-2">
              <p className="qb-meta-label">Tasks</p>
              <p className="text-lg font-semibold tracking-[-0.02em]">Milestone 6 stub</p>
              <p className="text-sm text-secondary">
                Task clarification and delivery-task planning arrive in Milestone 6. This tab is
                intentionally reserved so the Feature Editor navigation is stable before those
                workflows land.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card surface="panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
                <div>
                  <p className="qb-meta-label">{kindLabels[activeKind!]}</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {currentRevision ? `Revision ${currentRevision.version}` : "No revision yet"}
                  </p>
                  {currentRevision && !isViewingHeadRevision ? (
                    <p className="mt-2 text-sm text-secondary">
                      Viewing a historical revision. Saving creates a new head revision.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <AiWorkflowButton
                    active={generateRevisionMutation.isPending || Boolean(activeJob)}
                    disabled={generateRevisionMutation.isPending || Boolean(activeJob)}
                    label={`Generate ${kindLabels[activeKind!]}`}
                    onClick={() => {
                      void generateRevisionMutation.mutateAsync({
                        featureId,
                        kind: activeKind!,
                      });
                    }}
                    runningLabel="Generating..."
                    variant="secondary"
                  />
                  <Button
                    disabled={!currentRevision}
                    onClick={() => {
                      if (currentRevision) {
                        void navigator.clipboard.writeText(currentRevision.markdown);
                      }
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Copy markdown
                  </Button>
                  <Button
                    disabled={!currentRevision}
                    onClick={downloadMarkdown}
                    type="button"
                    variant="ghost"
                  >
                    Download markdown
                  </Button>
                  <Button
                    disabled={
                      !headRevision ||
                      !isViewingHeadRevision ||
                      headRevision.approval !== null ||
                      approveRevisionMutation.isPending
                    }
                    onClick={() => {
                      if (headRevision) {
                        void approveRevisionMutation.mutateAsync({
                          featureId,
                          kind: activeKind!,
                          revisionId: headRevision.id,
                        });
                      }
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Approve {kindLabels[activeKind!]}
                  </Button>
                </div>
              </div>

              {activeKind === "product" ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <Checkbox
                    checked={requirements.uxRequired}
                    label="UX workstream required"
                    onChange={(event) =>
                      setRequirements((current) => ({
                        ...current,
                        uxRequired: event.target.checked,
                      }))
                    }
                  />
                  <Checkbox
                    checked={requirements.techRequired}
                    label="Tech workstream required"
                    onChange={(event) =>
                      setRequirements((current) => ({
                        ...current,
                        techRequired: event.target.checked,
                      }))
                    }
                  />
                  <Checkbox
                    checked={requirements.userDocsRequired}
                    label="User docs required"
                    onChange={(event) =>
                      setRequirements((current) => ({
                        ...current,
                        userDocsRequired: event.target.checked,
                      }))
                    }
                  />
                  <Checkbox
                    checked={requirements.archDocsRequired}
                    label="Architecture docs required"
                    onChange={(event) =>
                      setRequirements((current) => ({
                        ...current,
                        archDocsRequired: event.target.checked,
                      }))
                    }
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]">
                <div className="grid gap-4">
                  {currentRevision ? (
                    <EditableMarkdownDocument
                      isSaving={createRevisionMutation.isPending}
                      markdown={currentRevision.markdown}
                      onSave={saveRevision}
                      saveLabel={`Save ${kindLabels[activeKind!]}`}
                    />
                  ) : (
                    <Alert tone="info">
                      No revision exists yet. Generate the first draft or start editing to create
                      version 1.
                    </Alert>
                  )}
                  {!currentRevision ? (
                    <EditableMarkdownDocument
                      isSaving={createRevisionMutation.isPending}
                      markdown=""
                      onSave={saveRevision}
                      saveLabel={`Create ${kindLabels[activeKind!]}`}
                    />
                  ) : null}
                  <NextActionBar
                    summary="Review the current draft, regenerate if the upstream planning context changed, then approve the head revision before moving downstream."
                    title={`${kindLabels[activeKind!]} next actions`}
                  >
                    <Badge tone={activeTrack?.status === "approved" ? "success" : "warning"}>
                      {activeTrack?.status === "approved" ? "approved" : "draft"}
                    </Badge>
                  </NextActionBar>
                </div>
                <div className="grid content-start gap-4 self-start">
                  <ReviewPanel />
                  <Card surface="rail">
                    <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                      <div>
                        <p className="qb-meta-label">Details</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Feature state</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="feature-status">Status</Label>
                        <Select
                          id="feature-status"
                          onChange={(event) => {
                            void updateFeatureMutation.mutateAsync({
                              featureId,
                              payload: {
                                status: event.target.value as (typeof statuses)[number],
                              },
                            });
                          }}
                          value={featureQuery.data?.status ?? "draft"}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="feature-priority">Priority</Label>
                        <Select
                          id="feature-priority"
                          onChange={(event) => {
                            void updateFeatureMutation.mutateAsync({
                              featureId,
                              payload: {
                                priority: event.target.value as (typeof priorities)[number],
                              },
                            });
                          }}
                          value={featureQuery.data?.priority ?? "must_have"}
                        >
                          {priorities.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority.replaceAll("_", " ")}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        onClick={() => {
                          void archiveFeatureMutation.mutateAsync(featureId);
                        }}
                        type="button"
                        variant="danger"
                      >
                        Archive
                      </Button>
                    </div>
                  </Card>
                  <Card surface="rail">
                    <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                      <div>
                        <p className="qb-meta-label">Dependencies</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Direct edges</p>
                      </div>
                      <Badge tone="neutral">{featureQuery.data?.dependencyIds.length ?? 0}</Badge>
                    </div>
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3">
                        {(featureQuery.data?.dependencyIds ?? []).length ? (
                          featureQuery.data?.dependencyIds.map((dependencyId) => (
                            <div
                              key={dependencyId}
                              className="flex items-center justify-between gap-3 border border-border/80 bg-panel-inset px-3 py-2"
                            >
                              <span className="text-sm text-foreground">
                                {dependencyTitleById.get(dependencyId) ?? dependencyId}
                              </span>
                              <Button
                                onClick={() => {
                                  void removeDependencyMutation.mutateAsync({
                                    featureId,
                                    dependsOnFeatureId: dependencyId,
                                  });
                                }}
                                type="button"
                                variant="ghost"
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-secondary">
                            This feature does not depend on any other features yet.
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="feature-dependency-select">Add dependency</Label>
                        <Select
                          id="feature-dependency-select"
                          onChange={(event) => setPendingDependencyId(event.target.value)}
                          value={pendingDependencyId}
                        >
                          <option value="">Select feature</option>
                          {dependencyOptions.map((feature) => (
                            <option key={feature.id} value={feature.id}>
                              {feature.featureKey} {feature.headRevision.title} ({feature.milestoneTitle})
                            </option>
                          ))}
                        </Select>
                        <Button
                          disabled={!pendingDependencyId}
                          onClick={() => {
                            void addDependencyMutation
                              .mutateAsync({
                                featureId,
                                payload: { dependsOnFeatureId: pendingDependencyId },
                              })
                              .then(() => {
                                setPendingDependencyId("");
                              });
                          }}
                          type="button"
                          variant="secondary"
                        >
                          Add dependency
                        </Button>
                      </div>
                    </div>
                  </Card>
                  <Card surface="rail">
                    <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                      <div>
                        <p className="qb-meta-label">History</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Revisions</p>
                      </div>
                      <Badge tone="neutral">{revisionsQuery.data?.revisions.length ?? 0}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {revisionsQuery.data?.revisions.length ? (
                        revisionsQuery.data.revisions.map((revision, index) => (
                          <button
                            key={revision.id}
                            className={[
                              "w-full border px-4 py-4 text-left transition-colors",
                              currentRevision?.id === revision.id
                                ? "border-accent/55 bg-accent/12"
                                : "border-border/80 bg-panel-inset hover:border-border-strong",
                            ].join(" ")}
                            onClick={() => {
                              setSelectedRevisionId(revision.id);
                            }}
                            type="button"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="neutral">v{revision.version}</Badge>
                              {index === 0 ? <Badge tone="success">head</Badge> : null}
                              {currentRevision?.id === revision.id ? (
                                <Badge tone="neutral">selected</Badge>
                              ) : null}
                              {revision.approval ? <Badge tone="success">approved</Badge> : null}
                            </div>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {revision.title}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-secondary">No revisions yet.</p>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </Card>
            {!latestJob && !currentRevision ? (
              <Alert tone="info">
                This workstream has not been generated yet. Use the generate action above or save a
                manual draft.
              </Alert>
            ) : null}
          </>
        )}
      </div>
    </ProjectPageFrame>
  );
};
