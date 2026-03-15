import { Link, useParams } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { useNextActionsQuery, usePhaseGatesQuery, useProjectJobsQuery, useProjectQuery, useSetupStatusQuery } from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

export const MissionControlPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const setupStatusQuery = useSetupStatusQuery(id);
  const phaseGatesQuery = usePhaseGatesQuery(id);
  const nextActionsQuery = useNextActionsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);

  useSseEvents(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <ProjectContextHeader project={projectQuery.data} setupStatus={setupStatusQuery.data} />
      <PageIntro
        eyebrow="Project"
        title="Mission Control"
        summary="Track phase progress, next actions, and recent background work for this project."
        meta={
          <>
            <Badge tone="info">orchestration surface</Badge>
            <Badge tone="neutral">
              {nextActionsQuery.data?.actions.length ?? 0} next actions
            </Badge>
            <Badge tone="neutral">{jobsQuery.data?.jobs.length ?? 0} tracked jobs</Badge>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_22rem]">
        <div className="grid gap-5">
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold tracking-tight">Next Actions</p>
              <Badge tone="info">queue</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {nextActionsQuery.data?.actions.map((action) => (
                <Link
                  key={action.key}
                  className="rounded-md border border-border/80 bg-panel/76 px-4 py-4 text-sm transition hover:border-accent/40 hover:bg-surface"
                  to={action.href}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    navigation target
                  </p>
                  <p className="mt-2 font-semibold tracking-tight">{action.label}</p>
                </Link>
              ))}
            </div>
          </Card>
          <Card surface="rail">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold tracking-tight">Phase Gates</p>
              <Badge tone="warning">review states</Badge>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {phaseGatesQuery.data?.phases.map((phase) => (
                <div key={phase.phase} className="rounded-md border border-border/80 bg-panel/78 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium tracking-tight">{phase.phase}</p>
                    <Badge tone={phase.items.every((item) => item.passed) ? "success" : "warning"}>
                      {phase.items.filter((item) => item.passed).length}/{phase.items.length}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {phase.items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-sm">
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
        <Card surface="rail" className="h-fit">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold tracking-tight">Recent Jobs</p>
            <Badge tone="neutral">background</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {jobsQuery.data?.jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="rounded-md border border-border/80 bg-panel/78 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium tracking-tight">{job.type}</p>
                  <Badge
                    tone={
                      job.status === "succeeded"
                        ? "success"
                        : job.status === "failed" || job.status === "cancelled"
                          ? "danger"
                          : "info"
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  job record
                </p>
              </div>
            ))}
            {jobsQuery.data?.jobs.length === 0 ? (
              <div className="rounded-md border border-border/80 bg-panel/78 p-4 text-sm text-muted-foreground">
                No background jobs recorded yet.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </AppFrame>
  );
};
