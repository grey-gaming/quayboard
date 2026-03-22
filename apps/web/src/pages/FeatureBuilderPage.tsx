import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildFeatureBuilderTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Drawer } from "../components/ui/Drawer.js";
import { FeatureDependencyGraph } from "../components/workflow/FeatureDependencyGraph.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useAddFeatureDependencyMutation,
  useAppendFeaturesFromOnePagerMutation,
  useArchiveFeatureMutation,
  useCreateFeatureMutation,
  useFeatureGraphQuery,
  useFeatureRollupQuery,
  useFeaturesQuery,
  useMilestonesQuery,
  useProjectQuery,
  useUpdateFeatureMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const featureKinds = [
  "screen",
  "menu",
  "dialog",
  "system",
  "service",
  "library",
  "pipeline",
  "placeholder_visual",
  "placeholder_non_visual",
] as const;

const priorities = ["must_have", "should_have", "could_have", "wont_have"] as const;
const statuses = ["draft", "approved", "in_progress", "completed"] as const;

export const FeatureBuilderPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const milestonesQuery = useMilestonesQuery(id);
  const featuresQuery = useFeaturesQuery(id);
  const rollupQuery = useFeatureRollupQuery(id);
  const graphQuery = useFeatureGraphQuery(id);
  const createFeatureMutation = useCreateFeatureMutation(id);
  const appendFeaturesMutation = useAppendFeaturesFromOnePagerMutation(id);
  const updateFeatureMutation = useUpdateFeatureMutation(id);
  const archiveFeatureMutation = useArchiveFeatureMutation(id);
  const addDependencyMutation = useAddFeatureDependencyMutation(id);
  const approvedMilestones = (milestonesQuery.data?.milestones ?? []).filter(
    (milestone) => milestone.status === "approved",
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [kind, setKind] = useState<(typeof featureKinds)[number]>("screen");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("must_have");
  const [milestoneId, setMilestoneId] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dependencyFeatureId, setDependencyFeatureId] = useState("");
  const [dependsOnFeatureId, setDependsOnFeatureId] = useState("");

  useSseEvents(id);

  const filteredFeatures = useMemo(
    () =>
      (featuresQuery.data?.features ?? []).filter((feature) => {
        if (statusFilter !== "all" && feature.status !== statusFilter) {
          return false;
        }

        if (kindFilter !== "all" && feature.kind !== kindFilter) {
          return false;
        }

        if (priorityFilter !== "all" && feature.priority !== priorityFilter) {
          return false;
        }

        return true;
      }),
    [featuresQuery.data?.features, kindFilter, priorityFilter, statusFilter],
  );

  const resetDrawer = () => {
    setTitle("");
    setSummary("");
    setAcceptanceCriteria("");
    setKind("screen");
    setPriority("must_have");
    setMilestoneId("");
    setIsDrawerOpen(false);
  };

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
      tertiaryItems={buildFeatureBuilderTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Features"
        title="Feature Builder"
        summary="Build the initial feature catalogue, seed new features from the approved overview document, and wire direct dependencies before the feature workstream editors arrive."
        meta={
          <>
            <Badge tone="neutral">{featuresQuery.data?.features.length ?? 0} active features</Badge>
            <Badge tone="neutral">
              {approvedMilestones.length} approved milestone
              {approvedMilestones.length === 1 ? "" : "s"}
            </Badge>
          </>
        }
      />
      <div className="grid gap-4">
        <Card surface="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="qb-meta-label">Catalogue controls</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Feature intake</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsDrawerOpen(true)} variant="primary">
                New feature
              </Button>
              <AiWorkflowButton
                active={appendFeaturesMutation.isPending}
                disabled={appendFeaturesMutation.isPending || !milestoneId}
                label="Append From Overview"
                onClick={() => {
                  if (!milestoneId) {
                    return;
                  }
                  void appendFeaturesMutation.mutateAsync({ milestoneId });
                }}
                runningLabel="Appending..."
                variant="secondary"
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="feature-target-milestone">Seed target milestone</Label>
              <Select
                id="feature-target-milestone"
                onChange={(event) => setMilestoneId(event.target.value)}
                value={milestoneId}
              >
                <option value="">Select approved milestone</option>
                {approvedMilestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feature-status-filter">Status filter</Label>
              <Select
                id="feature-status-filter"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feature-kind-filter">Kind filter</Label>
              <Select
                id="feature-kind-filter"
                onChange={(event) => setKindFilter(event.target.value)}
                value={kindFilter}
              >
                <option value="all">All kinds</option>
                {featureKinds.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feature-priority-filter">Priority filter</Label>
              <Select
                id="feature-priority-filter"
                onChange={(event) => setPriorityFilter(event.target.value)}
                value={priorityFilter}
              >
                <option value="all">All priorities</option>
                {priorities.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_24rem]">
          <div className="grid gap-4">
            <Card surface="panel">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">Feature catalogue</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Current features</p>
                </div>
                <Badge tone="neutral">{filteredFeatures.length} shown</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                {filteredFeatures.map((feature) => (
                  <div key={feature.id} className="border border-border/80 bg-panel-inset p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="neutral">{feature.featureKey}</Badge>
                          <Badge tone="neutral">{feature.milestoneTitle}</Badge>
                        </div>
                        <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                          {feature.headRevision.title}
                        </p>
                        <p className="mt-2 text-sm text-secondary">{feature.headRevision.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {feature.headRevision.acceptanceCriteria.map((criterion) => (
                            <Badge key={criterion} tone="warning">
                              {criterion}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2 md:w-56">
                        <Link
                          className="inline-flex min-h-10 items-center justify-center border border-transparent bg-transparent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-secondary transition-colors duration-150 hover:border-border hover:bg-panel-inset hover:text-foreground"
                          to={`/projects/${id}/features/${feature.id}`}
                        >
                          Open editor
                        </Link>
                        <Select
                          onChange={(event) => {
                            void updateFeatureMutation.mutateAsync({
                              featureId: feature.id,
                              payload: {
                                status: event.target.value as (typeof statuses)[number],
                              },
                            });
                          }}
                          value={feature.status}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </Select>
                        <Select
                          onChange={(event) => {
                            void updateFeatureMutation.mutateAsync({
                              featureId: feature.id,
                              payload: {
                                priority: event.target.value as (typeof priorities)[number],
                              },
                            });
                          }}
                          value={feature.priority}
                        >
                          {priorities.map((entry) => (
                            <option key={entry} value={entry}>
                              {entry.replaceAll("_", " ")}
                            </option>
                          ))}
                        </Select>
                        <Button
                          onClick={() => {
                            void archiveFeatureMutation.mutateAsync(feature.id);
                          }}
                          variant="danger"
                        >
                          Archive
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredFeatures.length === 0 ? (
                  <p className="text-sm text-secondary">No features match the current filters.</p>
                ) : null}
              </div>
            </Card>
            <Card surface="panel">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">Dependency graph</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Feature edges</p>
                </div>
              </div>
              <div className="mt-4">
                <FeatureDependencyGraph graph={graphQuery.data ?? { nodes: [], edges: [] }} />
              </div>
            </Card>
          </div>
          <div className="grid gap-4">
            <Card surface="rail">
              <p className="qb-meta-label">Rollup</p>
              <div className="mt-4 grid gap-2 text-sm text-secondary">
                <p>Active: {rollupQuery.data?.totals.active ?? 0}</p>
                <p>Archived: {rollupQuery.data?.totals.archived ?? 0}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(rollupQuery.data?.byPriority ?? []).map((entry) => (
                    <Badge key={entry.key} tone="neutral">
                      {entry.key.replaceAll("_", " ")}: {entry.count}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
            <Card surface="rail">
              <p className="qb-meta-label">Wire dependency</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="dependency-feature">Feature</Label>
                  <Select
                    id="dependency-feature"
                    onChange={(event) => setDependencyFeatureId(event.target.value)}
                    value={dependencyFeatureId}
                  >
                    <option value="">Select feature</option>
                    {(featuresQuery.data?.features ?? []).map((feature) => (
                      <option key={feature.id} value={feature.id}>
                        {feature.headRevision.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dependency-target">Depends on</Label>
                  <Select
                    id="dependency-target"
                    onChange={(event) => setDependsOnFeatureId(event.target.value)}
                    value={dependsOnFeatureId}
                  >
                    <option value="">Select dependency</option>
                    {(featuresQuery.data?.features ?? []).map((feature) => (
                      <option key={feature.id} value={feature.id}>
                        {feature.headRevision.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  disabled={!dependencyFeatureId || !dependsOnFeatureId}
                  onClick={() => {
                    void addDependencyMutation
                      .mutateAsync({
                        featureId: dependencyFeatureId,
                        payload: { dependsOnFeatureId },
                      })
                      .then(() => {
                        setDependencyFeatureId("");
                        setDependsOnFeatureId("");
                      });
                  }}
                  variant="secondary"
                >
                  Add dependency
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <Drawer onClose={resetDrawer} open={isDrawerOpen} title="Create feature">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="drawer-feature-title">Title</Label>
            <Input
              id="drawer-feature-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drawer-feature-summary">Summary</Label>
            <Textarea
              id="drawer-feature-summary"
              onChange={(event) => setSummary(event.target.value)}
              value={summary}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drawer-feature-criteria">Acceptance criteria</Label>
            <Textarea
              id="drawer-feature-criteria"
              onChange={(event) => setAcceptanceCriteria(event.target.value)}
              value={acceptanceCriteria}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="drawer-feature-milestone">Approved milestone</Label>
              <Select
                id="drawer-feature-milestone"
                onChange={(event) => setMilestoneId(event.target.value)}
                value={milestoneId}
              >
                <option value="">Select milestone</option>
                {approvedMilestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drawer-feature-kind">Kind</Label>
              <Select
                id="drawer-feature-kind"
                onChange={(event) => setKind(event.target.value as (typeof featureKinds)[number])}
                value={kind}
              >
                {featureKinds.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drawer-feature-priority">Priority</Label>
              <Select
                id="drawer-feature-priority"
                onChange={(event) =>
                  setPriority(event.target.value as (typeof priorities)[number])
                }
                value={priority}
              >
                {priorities.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!title.trim() || !summary.trim() || !acceptanceCriteria.trim() || !milestoneId}
              onClick={() => {
                void createFeatureMutation
                  .mutateAsync({
                    milestoneId,
                    kind,
                    priority,
                    title: title.trim(),
                    summary: summary.trim(),
                    acceptanceCriteria: acceptanceCriteria
                      .split("\n")
                      .map((entry) => entry.trim())
                      .filter(Boolean),
                  })
                  .then(() => {
                    resetDrawer();
                  });
              }}
              variant="primary"
            >
              Create feature
            </Button>
          </div>
        </div>
      </Drawer>
    </ProjectPageFrame>
  );
};
