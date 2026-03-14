import { Link, useParams } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { PageIntro } from "../components/composites/PageIntro.js";
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
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <p className="font-semibold">Next Actions</p>
          <div className="mt-4 grid gap-3">
            {nextActionsQuery.data?.actions.map((action) => (
              <Link
                key={action.key}
                className="rounded-lg border border-border/60 px-4 py-3 text-sm hover:bg-muted/50"
                to={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <p className="font-semibold">Recent Jobs</p>
          <div className="mt-4 grid gap-3">
            {jobsQuery.data?.jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="font-medium">{job.type}</p>
                <p className="text-muted-foreground">{job.status}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <p className="font-semibold">Phase Gates</p>
        <div className="mt-4 grid gap-4">
          {phaseGatesQuery.data?.phases.map((phase) => (
            <div key={phase.phase} className="rounded-lg border border-border/60 p-4">
              <p className="font-medium">{phase.phase}</p>
              <div className="mt-3 grid gap-2">
                {phase.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">
                      {item.passed ? "passed" : "pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppFrame>
  );
};
