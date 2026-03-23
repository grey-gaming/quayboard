import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildFeatureBuilderTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Drawer } from "../components/ui/Drawer.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Checkbox } from "../components/ui/Checkbox.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useAddFeatureDependencyMutation,
  useAppendFeaturesFromOnePagerMutation,
  useArchiveFeatureMutation,
  useCreateFeatureMutation,
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
  const [drawerMilestoneId, setDrawerMilestoneId] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<string[]>([]);

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

  const filteredFeaturesByMilestone = useMemo(() => {
    const grouped = new Map<string, typeof filteredFeatures>();

    for (const milestone of approvedMilestones) {
      grouped.set(milestone.id, []);
    }

    for (const feature of filteredFeatures) {
      const existing = grouped.get(feature.milestoneId) ?? [];
      existing.push(feature);
      grouped.set(feature.milestoneId, existing);
    }

    return grouped;
  }, [approvedMilestones, filteredFeatures]);

  const dependencyOptions = useMemo(
    () =>
      (featuresQuery.data?.features ?? []).map((feature) => ({
        id: feature.id,
        label: `${feature.featureKey} ${feature.headRevision.title}`,
        milestoneTitle: feature.milestoneTitle,
      })),
    [featuresQuery.data?.features],
  );

  const resetDrawer = () => {
    setTitle("");
    setSummary("");
    setAcceptanceCriteria("");
    setKind("screen");
    setPriority("must_have");
    setDrawerMilestoneId("");
    setSelectedDependencyIds([]);
    setIsDrawerOpen(false);
  };

  const openCreateDrawer = (milestoneId: string) => {
    setDrawerMilestoneId(milestoneId);
    setIsDrawerOpen(true);
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
        summary="Review the feature catalogue by milestone, generate milestone-scoped features from approved planning documents, and open feature editors to manage dependencies and workstreams."
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
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Milestone catalogue</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Feature catalogue</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Milestones</p>
              </div>
              <Badge tone="neutral">{filteredFeatures.length} shown</Badge>
            </div>
            <div className="mt-4 grid gap-4">
              {approvedMilestones.map((milestone) => {
                const milestoneFeatures = filteredFeaturesByMilestone.get(milestone.id) ?? [];

                return (
                  <Card key={milestone.id} surface="inset">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-4">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="neutral">{milestone.title}</Badge>
                          <Badge tone="neutral">{milestoneFeatures.length} shown</Badge>
                          <Badge tone="neutral">{milestone.featureCount} total</Badge>
                        </div>
                        <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                          {milestone.title}
                        </p>
                        <p className="mt-2 text-sm text-secondary">{milestone.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AiWorkflowButton
                          active={
                            appendFeaturesMutation.isPending &&
                            appendFeaturesMutation.variables?.milestoneId === milestone.id
                          }
                          disabled={appendFeaturesMutation.isPending}
                          label="Generate features"
                          onClick={() => {
                            void appendFeaturesMutation.mutateAsync({ milestoneId: milestone.id });
                          }}
                          runningLabel="Generating..."
                          variant="secondary"
                        />
                        <Button
                          onClick={() => {
                            openCreateDrawer(milestone.id);
                          }}
                          variant="primary"
                        >
                          New feature
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {milestoneFeatures.map((feature) => (
                        <div key={feature.id} className="border border-border/80 bg-panel p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <Badge tone="neutral">{feature.featureKey}</Badge>
                                <Badge tone="neutral">{feature.kind.replaceAll("_", " ")}</Badge>
                              </div>
                              <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                                {feature.headRevision.title}
                              </p>
                              <p className="mt-2 text-sm text-secondary">
                                {feature.headRevision.summary}
                              </p>
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
                      {milestoneFeatures.length === 0 ? (
                        <p className="text-sm text-secondary">
                          No features match the current filters for this milestone.
                        </p>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
              {approvedMilestones.length === 0 ? (
                <p className="text-sm text-secondary">
                  Approve at least one milestone before building the feature catalogue.
                </p>
              ) : null}
            </div>
          </Card>
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
              <Input
                disabled
                id="drawer-feature-milestone"
                value={
                  approvedMilestones.find((milestone) => milestone.id === drawerMilestoneId)?.title ??
                  ""
                }
              />
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
          <div className="grid gap-2">
            <Label>Direct dependencies</Label>
            <div className="grid gap-2 border border-border/80 bg-panel-inset p-3">
              {dependencyOptions.length ? (
                dependencyOptions.map((feature) => (
                  <Checkbox
                    checked={selectedDependencyIds.includes(feature.id)}
                    key={feature.id}
                    label={`${feature.label} (${feature.milestoneTitle})`}
                    onChange={(event) =>
                      setSelectedDependencyIds((current) =>
                        event.target.checked
                          ? [...current, feature.id]
                          : current.filter((id) => id !== feature.id),
                      )
                    }
                  />
                ))
              ) : (
                <p className="text-sm text-secondary">
                  No existing features are available to depend on yet.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={
                !title.trim() ||
                !summary.trim() ||
                !acceptanceCriteria.trim() ||
                !drawerMilestoneId
              }
              onClick={() => {
                void (async () => {
                  const created = await createFeatureMutation.mutateAsync({
                    milestoneId: drawerMilestoneId,
                    kind,
                    priority,
                    title: title.trim(),
                    summary: summary.trim(),
                    acceptanceCriteria: acceptanceCriteria
                      .split("\n")
                      .map((entry) => entry.trim())
                      .filter(Boolean),
                  });

                  for (const dependencyId of selectedDependencyIds) {
                    await addDependencyMutation.mutateAsync({
                      featureId: created.id,
                      payload: { dependsOnFeatureId: dependencyId },
                    });
                  }

                  resetDrawer();
                })();
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
