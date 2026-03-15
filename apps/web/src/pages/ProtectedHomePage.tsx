import { Link } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { useProjectsQuery } from "../hooks/use-projects.js";

export const ProtectedHomePage = () => {
  const projectsQuery = useProjectsQuery();
  const projectCount = projectsQuery.data?.projects.length ?? 0;

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Workspace"
        title="Projects"
        summary="Manage scratch-path onboarding from project creation through overview and user-flow approval."
        actions={
          <Link
            className="inline-flex items-center justify-center rounded-md border border-accent/55 bg-accent/16 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:bg-accent/26"
            to="/projects/new"
          >
            New Project
          </Link>
        }
        meta={
          <>
            <Badge tone="info">scratch path</Badge>
            <Badge tone="neutral">{projectCount} projects</Badge>
          </>
        }
      />
      <section className="grid gap-5">
        <Card surface="rail">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Project workspace
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight">
                Create a new project or continue an existing one.
              </p>
            </div>
            <Badge tone="warning">approval-driven planning</Badge>
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          {projectsQuery.data?.projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full hover:border-accent/40 hover:bg-panel/92" surface="panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold tracking-tight">{project.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {project.description ?? "No description yet."}
                    </p>
                  </div>
                  <Badge tone="info">{project.state}</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Mission Control
                  </p>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
                    open
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          {projectCount === 0 ? (
            <Card surface="rail">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Empty workspace
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight">
                No projects yet.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a scratch-path project to set up repository access, generate an overview,
                and define user flows.
              </p>
            </Card>
          ) : null}
        </div>
      </section>
    </AppFrame>
  );
};
