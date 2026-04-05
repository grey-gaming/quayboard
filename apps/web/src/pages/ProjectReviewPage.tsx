import { useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildImplementationTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
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

export const ProjectReviewPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const latestReviewQuery = useLatestProjectReviewQuery(id);
  const reviewsQuery = useProjectReviewsQuery(id);
  const finalizeMutation = useFinalizeMilestonePlanMutation(id);
  const reopenMutation = useReopenMilestonePlanMutation(id);
  const startMutation = useStartProjectReviewMutation(id);
  const retryMutation = useRetryProjectReviewFixesMutation(id);

  useSseEvents(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  const latestSession = latestReviewQuery.data?.session ?? null;
  const latestAttempt = latestSession?.attempts.at(-1) ?? null;

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

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="grid gap-4">
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={
                  projectQuery.data.milestonePlanStatus !== "finalized" || startMutation.isPending
                }
                onClick={() => startMutation.mutate()}
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
                onClick={() => latestSession && retryMutation.mutate(latestSession.id)}
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
                {latestAttempt?.reportMarkdown ? (
                  <pre className="max-h-[32rem] overflow-auto border border-border/70 bg-background/70 p-4 text-sm text-secondary">
                    {latestAttempt.reportMarkdown}
                  </pre>
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
              {(latestAttempt?.findings ?? []).length === 0 ? (
                <p className="text-sm text-secondary">No persisted findings for the latest attempt.</p>
              ) : (
                latestAttempt!.findings.map((finding) => (
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
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </ProjectPageFrame>
  );
};
