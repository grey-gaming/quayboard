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
import {
  useApproveFeatureWorkstreamRevisionMutation,
  useCreateFeatureWorkstreamRevisionMutation,
  useFeatureQuery,
  useFeatureTracksQuery,
  useFeatureWorkstreamRevisionsQuery,
  useGenerateFeatureWorkstreamRevisionMutation,
  useProjectJobsQuery,
  useProjectQuery,
} from "../hooks/use-projects.js";
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

export const FeatureEditorPage = () => {
  const { id = "", featureId = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const featureQuery = useFeatureQuery(featureId);
  const tracksQuery = useFeatureTracksQuery(featureId);
  const jobsQuery = useProjectJobsQuery(id);
  const createRevisionMutation = useCreateFeatureWorkstreamRevisionMutation(id);
  const generateRevisionMutation = useGenerateFeatureWorkstreamRevisionMutation(id);
  const approveRevisionMutation = useApproveFeatureWorkstreamRevisionMutation(id);

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
                <div className="grid gap-4">
                  <ReviewPanel />
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
