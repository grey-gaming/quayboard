import { Link, useParams } from "react-router-dom";

import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectJobsPanel } from "../components/workflow/ProjectJobsPanel.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import {
  useNextActionsQuery,
  usePhaseGatesQuery,
  useProjectJobsQuery,
  useProjectQuery,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const phaseDisplayOrder = [
  "Project Setup",
  "Overview Document",
  "Product Spec",
  "UX Spec",
  "Technical Spec",
  "User Flows",
] as const;

const phaseOrderIndex = new Map<string, number>(
  phaseDisplayOrder.map((phase, index) => [phase, index]),
);

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

  const phases = [...(phaseGatesQuery.data?.phases ?? [])].sort((left, right) => {
    const leftIndex = phaseOrderIndex.get(left.phase) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = phaseOrderIndex.get(right.phase) ?? Number.MAX_SAFE_INTEGER;

    return leftIndex - rightIndex;
  });

  return (
    <AppFrame>
      <ProjectSubNav project={projectQuery.data} />
      <PageIntro
        eyebrow="Project"
        title="Mission Control"
        summary="Use this page to see the current planning stage, review recent background work, and pick the next action needed to move the project forward."
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
            <div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="mission-control-phase-gates">
              {phases.map((phase) => (
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
          <ProjectJobsPanel
            emptyMessage="No background jobs recorded yet."
            headerBadge="background"
            jobs={jobsQuery.data?.jobs ?? []}
            title="Recent Jobs"
          />
        </div>
      </div>
    </AppFrame>
  );
};
