import { Link, useParams } from "react-router-dom";

import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import {
  useNextActionsQuery,
  usePhaseGatesQuery,
  useProjectJobsQuery,
  useProjectQuery,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

const jobTone = (status: string) =>
  status === "succeeded"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : "info";

export const MissionControlPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const phaseGatesQuery = usePhaseGatesQuery(id);
  const nextActionsQuery = useNextActionsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);

  useSseEvents(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Loading project...</p>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <ProjectSubNav project={projectQuery.data} />
      <PageIntro
        eyebrow="Project"
        title="Mission Control"
        summary="Track phase progress, next actions, and recent background work for this project."
        meta={
          <>
            <Badge tone="neutral">orchestration surface</Badge>
            <Badge tone="neutral">
              {nextActionsQuery.data?.actions.length ?? 0} next actions
            </Badge>
            <Badge tone="neutral">{jobsQuery.data?.jobs.length ?? 0} tracked jobs</Badge>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_20rem]">
        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Queue</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Next Actions</p>
              </div>
              <Badge tone="info">current focus</Badge>
            </div>
            <div className="mt-4 grid gap-0 border border-border/80">
              {nextActionsQuery.data?.actions.map((action, index) => (
                <Link
                  key={action.key}
                  className={[
                    "grid gap-3 border-t border-border/80 bg-panel-inset px-4 py-4 text-sm transition-colors duration-150 first:border-t-0 hover:bg-panel-active",
                    index === 0 ? "border-l-2 border-l-accent" : "",
                  ].join(" ")}
                  to={action.href}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold tracking-[-0.02em]">{action.label}</p>
                    <Badge tone={index === 0 ? "info" : "neutral"}>
                      {index === 0 ? "active" : "queued"}
                    </Badge>
                  </div>
                  <p className="qb-meta-label">navigation target</p>
                </Link>
              ))}
              {nextActionsQuery.data?.actions.length === 0 ? (
                <div className="qb-data-row text-sm text-secondary">
                  No next actions are queued for this project yet.
                </div>
              ) : null}
            </div>
          </Card>
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Review states</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Phase Gates</p>
              </div>
              <Badge tone="warning">review states</Badge>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {phaseGatesQuery.data?.phases.map((phase) => (
                <div key={phase.phase} className="border border-border/80 bg-panel-inset p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium tracking-[-0.02em]">{phase.phase}</p>
                    <Badge tone={phase.items.every((item) => item.passed) ? "success" : "warning"}>
                      {phase.items.filter((item) => item.passed).length}/{phase.items.length}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {phase.items.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-sm"
                      >
                        <span>{item.label}</span>
                        <span className={item.passed ? "text-success" : "text-muted-foreground"}>
                          {item.passed ? "passed" : "pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-4">
          <Card surface="rail" className="h-fit">
            <p className="qb-meta-label">Project status</p>
            <div className="mt-4 grid gap-2">
              <div className="qb-kv">
                <p className="qb-meta-label">Phase gates</p>
                <p className="text-sm text-foreground">
                  {phaseGatesQuery.data?.phases.length ?? 0} tracked phases
                </p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Next actions</p>
                <p className="text-sm text-foreground">
                  {nextActionsQuery.data?.actions.length ?? 0} queued transitions
                </p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Recent jobs</p>
                <p className="text-sm text-foreground">
                  {jobsQuery.data?.jobs.length ?? 0} background records
                </p>
              </div>
            </div>
          </Card>
          <Card surface="rail" className="h-fit">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Background</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Recent Jobs</p>
              </div>
              <Badge tone="neutral">background</Badge>
            </div>
            <div className="mt-4 grid gap-0 border border-border/80">
              {jobsQuery.data?.jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="grid gap-2 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium tracking-[-0.02em]">{job.type}</p>
                    <Badge tone={jobTone(job.status)}>{job.status}</Badge>
                  </div>
                  <p className="qb-meta-label">queued {formatDateTime(job.queuedAt)}</p>
                  <p className="text-secondary">
                    {job.completedAt
                      ? `completed ${formatDateTime(job.completedAt)}`
                      : job.startedAt
                        ? `started ${formatDateTime(job.startedAt)}`
                        : "awaiting execution"}
                  </p>
                </div>
              ))}
              {jobsQuery.data?.jobs.length === 0 ? (
                <div className="qb-data-row text-sm text-secondary">
                  No background jobs recorded yet.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
};
