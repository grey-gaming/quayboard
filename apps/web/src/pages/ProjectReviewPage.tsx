import { useState } from "react";
import { useParams } from "react-router-dom";

import type { ProjectReviewFinding } from "@quayboard/shared";

import { MarkdownDocument } from "../components/composites/MarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { buildImplementationTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useProjectQuery } from "../hooks/use-projects.js";
import {
  useFinalizeMilestonePlanMutation,
  useLatestProjectReviewQuery,
  useProjectReviewsQuery,
  useReopenMilestonePlanMutation,
  useRetryProjectReviewFixesMutation,
  useStartProjectReviewMutation,
} from "../hooks/use-project-reviews.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const severityRank: Record<ProjectReviewFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const closedFindingStatuses = new Set<ProjectReviewFinding["status"]>([
  "resolved",
  "ignored",
  "accepted",
  "superseded",
]);

const sortOpenFindings = (left: ProjectReviewFinding, right: ProjectReviewFinding) =>
  severityRank[left.severity] - severityRank[right.severity] ||
  left.createdAt.localeCompare(right.createdAt);

const sortClosedFindings = (left: ProjectReviewFinding, right: ProjectReviewFinding) =>
  (right.resolvedAt ?? right.createdAt).localeCompare(left.resolvedAt ?? left.createdAt) ||
  right.createdAt.localeCompare(left.createdAt);

export const ProjectReviewPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const latestReviewQuery = useLatestProjectReviewQuery(id);
  const reviewsQuery = useProjectReviewsQuery(id);
  const finalizeMutation = useFinalizeMilestonePlanMutation(id);
  const reopenMutation = useReopenMilestonePlanMutation(id);
  const startMutation = useStartProjectReviewMutation(id);
  const retryMutation = useRetryProjectReviewFixesMutation(id);
  const [maxLoops, setMaxLoops] = useState("5");

  useSseEvents(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  const latestSession = latestReviewQuery.data?.session ?? null;
  const latestSucceededReviewAttempt =
    [...(latestSession?.attempts ?? [])]
      .reverse()
      .find((attempt) => attempt.kind === "review" && attempt.status === "succeeded") ?? null;
  const sessionReviewFindings = (latestSession?.attempts ?? [])
    .filter((attempt) => attempt.kind === "review")
    .flatMap((attempt) => attempt.findings);
  const openFindings = sessionReviewFindings
    .filter((finding) => finding.status === "open")
    .sort(sortOpenFindings);
  const closedFindings = sessionReviewFindings
    .filter((finding) => closedFindingStatuses.has(finding.status))
    .sort(sortClosedFindings);

  return (
    <ProjectPageFrame
      activeSection="implementation"
      project={projectQuery.data}
      tertiaryItems={buildImplementationTertiaryItems(projectQuery.data)}
    >
      <PageIntro
        eyebrow="Implementation"
        title="Project Review"
        summary="Finalize milestone planning, run the repository-wide review, inspect persisted findings, and track automatic remediation loops."
        meta={
          <>
            <Badge tone="neutral">{reviewsQuery.data?.sessions.length ?? 0} sessions</Badge>
            <Badge tone="neutral">
              {latestSession?.status?.replaceAll("_", " ") ?? "not started"}
            </Badge>
          </>
        }
      />

      {latestReviewQuery.error || reviewsQuery.error ? (
        <Alert tone="error">Failed to load project review state.</Alert>
      ) : null}

      <div
        className="grid items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]"
        data-testid="project-review-layout"
      >
        <div className="grid content-start gap-4 self-start">
          <Card surface="panel">
            <p className="qb-meta-label">Milestone Plan</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
              {projectQuery.data.milestonePlanStatus === "finalized" ? "Finalized" : "Open"}
            </p>
            <p className="mt-2 text-sm text-secondary">
              Finalize only when you are confident no more milestones should be generated.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={
                  projectQuery.data.milestonePlanStatus === "finalized" || finalizeMutation.isPending
                }
                onClick={() => finalizeMutation.mutate()}
                variant="primary"
              >
                Finalize plan
              </Button>
              <Button
                disabled={
                  projectQuery.data.milestonePlanStatus !== "finalized" || reopenMutation.isPending
                }
                onClick={() => reopenMutation.mutate()}
                variant="secondary"
              >
                Reopen plan
              </Button>
            </div>
          </Card>

          <Card surface="panel">
            <p className="qb-meta-label">Run Controls</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Review automation</p>
            <div className="mt-4">
              <label className="block text-xs font-medium uppercase tracking-[0.16em] text-secondary" htmlFor="project-review-max-loops">
                Max loops
              </label>
              <Input
                id="project-review-max-loops"
                min={1}
                step={1}
                type="number"
                value={maxLoops}
                onChange={(event) => setMaxLoops(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={
                  projectQuery.data.milestonePlanStatus !== "finalized" || startMutation.isPending
                }
                onClick={() =>
                  startMutation.mutate({
                    maxLoops: Number.parseInt(maxLoops, 10) || 5,
                    trigger: "manual",
                  })
                }
                variant="primary"
              >
                Run project review
              </Button>
              <Button
                disabled={
                  !latestSession ||
                  (latestSession.status !== "needs_fixes" && latestSession.status !== "failed") ||
                  retryMutation.isPending
                }
                onClick={() =>
                  latestSession &&
                  retryMutation.mutate({
                    reviewId: latestSession.id,
                    maxLoops: Number.parseInt(maxLoops, 10) || latestSession.maxLoops,
                  })
                }
                variant="secondary"
              >
                Retry fixes
              </Button>
            </div>
          </Card>

          <Card surface="panel">
            <p className="qb-meta-label">History</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Review sessions</p>
            <div className="mt-4 grid gap-3">
              {(reviewsQuery.data?.sessions ?? []).length === 0 ? (
                <p className="text-sm text-secondary">No project reviews yet.</p>
              ) : (
                reviewsQuery.data!.sessions.map((session) => (
                  <div key={session.id} className="border border-border/70 bg-panel-inset p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{session.id}</p>
                      <Badge tone="neutral">{session.status.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-secondary">
                      {session.attempts.length} attempts · {session.loopCount}/{session.maxLoops} loops
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="qb-meta-label">Latest Review</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                  {latestSession ? latestSession.status.replaceAll("_", " ") : "Not started"}
                </p>
              </div>
              {latestReviewQuery.isLoading ? <Spinner /> : null}
            </div>
            {!latestSession ? (
              <p className="mt-4 text-sm text-secondary">
                Finalize milestone planning, then run the project review.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {latestSession.pullRequestUrl ? (
                  <p className="text-sm text-secondary">
                    Fix PR:{" "}
                    <a
                      className="text-accent hover:underline"
                      href={latestSession.pullRequestUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open pull request
                    </a>
                  </p>
                ) : null}
                {latestSucceededReviewAttempt?.reportMarkdown ? (
                  <div className="max-h-[32rem] overflow-auto border border-border/70 bg-background/70 p-4">
                    <MarkdownDocument
                      markdown={latestSucceededReviewAttempt.reportMarkdown}
                      showTableOfContents
                    />
                  </div>
                ) : (
                  <p className="text-sm text-secondary">
                    The latest attempt has not produced a report yet.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card surface="panel">
            <p className="qb-meta-label">Findings</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Normalized findings</p>
            <div className="mt-4 grid gap-3">
              {openFindings.length === 0 && closedFindings.length === 0 ? (
                <p className="text-sm text-secondary">No persisted findings for this review session.</p>
              ) : (
                <>
                  {openFindings.length > 0 ? (
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">Unaddressed</p>
                        <Badge tone="warning">{openFindings.length}</Badge>
                      </div>
                      {openFindings.map((finding) => (
                        <div key={finding.id} className="border border-border/70 bg-panel-inset p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{finding.finding}</p>
                            <div className="flex gap-2">
                              <Badge tone="neutral">{finding.category}</Badge>
                              <Badge tone="neutral">{finding.severity}</Badge>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-secondary">{finding.whyItMatters}</p>
                          <p className="mt-2 text-sm text-foreground">
                            Recommended: {finding.recommendedImprovement}
                          </p>
                          {finding.evidence.length > 0 ? (
                            <p className="mt-2 text-xs text-secondary">
                              Evidence: {finding.evidence.map((entry) => entry.path).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {closedFindings.length > 0 ? (
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">Closed / non-blocking</p>
                        <Badge tone="success">{closedFindings.length}</Badge>
                      </div>
                      {closedFindings.map((finding) => (
                        <div key={finding.id} className="border border-border/70 bg-panel-inset p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{finding.finding}</p>
                            <div className="flex gap-2">
                              <Badge tone="neutral">{finding.category}</Badge>
                              <Badge tone="neutral">{finding.severity}</Badge>
                              <Badge tone="success">{finding.status}</Badge>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-secondary">{finding.whyItMatters}</p>
                          <p className="mt-2 text-sm text-foreground">
                            Recommended: {finding.recommendedImprovement}
                          </p>
                          {finding.evidence.length > 0 ? (
                            <p className="mt-2 text-xs text-secondary">
                              Evidence: {finding.evidence.map((entry) => entry.path).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </ProjectPageFrame>
  );
};
