import { useState } from "react";
import { useParams } from "react-router-dom";

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
import { Textarea } from "../components/ui/Textarea.js";
import {
  useBugsQuery,
  useCreateBugMutation,
  useFeaturesQuery,
  useFixBugMutation,
  useProjectQuery,
  useUpdateBugMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const statusTone = (status: "open" | "in_progress" | "fixed") =>
  status === "fixed" ? "success" : status === "in_progress" ? "info" : "neutral";

export const ImplementationBugsPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const featuresQuery = useFeaturesQuery(id);
  const bugsQuery = useBugsQuery(id);
  const createBugMutation = useCreateBugMutation(id);
  const updateBugMutation = useUpdateBugMutation(id);
  const fixBugMutation = useFixBugMutation(id);
  const [description, setDescription] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [editingBugId, setEditingBugId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [editingFeatureId, setEditingFeatureId] = useState("");

  useSseEvents(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  const bugs = bugsQuery.data?.bugs ?? [];
  const features = featuresQuery.data?.features ?? [];
  const openBugs = bugs.filter((bug) => bug.status !== "fixed");
  const fixedBugs = bugs.filter((bug) => bug.status === "fixed");
  const featureTitleById = new Map(
    features.map((feature) => [feature.id, `${feature.featureKey} ${feature.headRevision.title}`]),
  );

  return (
    <ProjectPageFrame
      activeSection="implementation"
      project={projectQuery.data}
      tertiaryItems={buildImplementationTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Implementation"
        title="Bugs"
        summary="Capture implementation defects in free text, edit open reports, send them to the sandbox for automated fixes, and keep a visible history of what has already been resolved."
        meta={
          <>
            <Badge tone="neutral">{openBugs.length} open</Badge>
            <Badge tone="neutral">{fixedBugs.length} fixed</Badge>
          </>
        }
      />

      {bugsQuery.error ? <Alert tone="error">Failed to load bugs.</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid gap-4">
          <Card surface="panel">
            <p className="qb-meta-label">New Bug</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Report a defect</p>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <label className="qb-meta-label" htmlFor="bug-feature">
                  Feature link
                </label>
                <Select
                  id="bug-feature"
                  onChange={(event) => setFeatureId(event.target.value)}
                  value={featureId}
                >
                  <option value="">Project-level bug</option>
                  {features.map((feature) => (
                    <option key={feature.id} value={feature.id}>
                      {feature.featureKey} {feature.headRevision.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="qb-meta-label" htmlFor="bug-description">
                  Description
                </label>
                <Textarea
                  id="bug-description"
                  className="min-h-[12rem]"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  disabled={!description.trim() || createBugMutation.isPending}
                  onClick={() => {
                    createBugMutation.mutate(
                      {
                        description: description.trim(),
                        ...(featureId ? { featureId } : {}),
                      },
                      {
                        onSuccess: () => {
                          setDescription("");
                          setFeatureId("");
                        },
                      },
                    );
                  }}
                >
                  {createBugMutation.isPending ? "Saving..." : "Create bug"}
                </Button>
                {createBugMutation.error ? (
                  <p className="text-sm text-danger">{createBugMutation.error.message}</p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card surface="panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="qb-meta-label">Open Bugs</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Current backlog</p>
              </div>
              {bugsQuery.isLoading ? <Spinner /> : null}
            </div>
            <div className="mt-4 grid gap-3">
              {openBugs.length === 0 ? (
                <p className="text-sm text-secondary">No open bugs.</p>
              ) : (
                openBugs.map((bug) => {
                  const isEditing = editingBugId === bug.id;
                  const isBusy = bug.status === "in_progress";

                  return (
                    <div key={bug.id} className="border border-border/70 bg-panel-inset p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(bug.status) as never}>{bug.status}</Badge>
                          {bug.featureId ? (
                            <span className="text-xs text-secondary">
                              {featureTitleById.get(bug.featureId) ?? bug.featureId}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {bug.status === "open" ? (
                            <Button
                              onClick={() => {
                                setEditingBugId(bug.id);
                                setEditingDescription(bug.description);
                                setEditingFeatureId(bug.featureId ?? "");
                              }}
                              variant="secondary"
                            >
                              Edit
                            </Button>
                          ) : null}
                          <Button
                            disabled={bug.status !== "open" || fixBugMutation.isPending}
                            onClick={() => fixBugMutation.mutate(bug.id)}
                          >
                            {isBusy ? "Fix running..." : "Fix"}
                          </Button>
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="mt-4 grid gap-3">
                          <Select
                            onChange={(event) => setEditingFeatureId(event.target.value)}
                            value={editingFeatureId}
                          >
                            <option value="">Project-level bug</option>
                            {features.map((feature) => (
                              <option key={feature.id} value={feature.id}>
                                {feature.featureKey} {feature.headRevision.title}
                              </option>
                            ))}
                          </Select>
                          <Textarea
                            className="min-h-[10rem]"
                            onChange={(event) => setEditingDescription(event.target.value)}
                            value={editingDescription}
                          />
                          <div className="flex gap-2">
                            <Button
                              disabled={!editingDescription.trim() || updateBugMutation.isPending}
                              onClick={() =>
                                updateBugMutation.mutate(
                                  {
                                    bugId: bug.id,
                                    payload: {
                                      description: editingDescription.trim(),
                                      featureId: editingFeatureId || null,
                                    },
                                  },
                                  {
                                    onSuccess: () => {
                                      setEditingBugId(null);
                                    },
                                  },
                                )
                              }
                            >
                              {updateBugMutation.isPending ? "Saving..." : "Save changes"}
                            </Button>
                            <Button onClick={() => setEditingBugId(null)} variant="ghost">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                          {bug.description}
                        </p>
                      )}
                      {bug.lastFixError ? (
                        <Alert className="mt-3" tone="error">
                          {bug.lastFixError}
                        </Alert>
                      ) : null}
                      {bug.latestFixPullRequestUrl ? (
                        <p className="mt-3 text-sm text-secondary">
                          Latest PR:{" "}
                          <a
                            className="text-accent hover:underline"
                            href={bug.latestFixPullRequestUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open pull request
                          </a>
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <Card surface="panel">
          <p className="qb-meta-label">Fixed History</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Resolved bugs</p>
          <div className="mt-4 grid gap-3">
            {fixedBugs.length === 0 ? (
              <p className="text-sm text-secondary">No fixed bugs yet.</p>
            ) : (
              fixedBugs.map((bug) => (
                <div key={bug.id} className="border border-border/70 bg-panel-inset p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="success">fixed</Badge>
                    <span className="text-xs text-secondary">
                      {new Date(bug.fixedAt ?? bug.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{bug.description}</p>
                  {bug.latestFixPullRequestUrl ? (
                    <p className="mt-3 text-sm text-secondary">
                      Merged PR:{" "}
                      <a
                        className="text-accent hover:underline"
                        href={bug.latestFixPullRequestUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open pull request
                      </a>
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </ProjectPageFrame>
  );
};
