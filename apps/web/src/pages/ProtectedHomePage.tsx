import { Link } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { useProjectsQuery } from "../hooks/use-projects.js";
import { formatDateTime } from "../lib/format.js";

const primaryLinkClassName =
  "inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover";

export const ProtectedHomePage = () => {
  const projectsQuery = useProjectsQuery();
  const projectCount = projectsQuery.data?.projects.length ?? 0;

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Projects"
        title="Projects"
        summary="View your projects, create a new one, and continue setup, overview, and user-flow planning."
        actions={
          <Link className={primaryLinkClassName} to="/projects/new">
            New Project
          </Link>
        }
      />
      <section>
        <Card data-testid="projects-list-card" surface="panel">
          <div className="border-b border-border/80 pb-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Projects</h2>
          </div>
          <div className="mt-4 grid gap-0 border border-border/80">
            {projectsQuery.data?.projects.map((project) => (
              <Link
                key={project.id}
                className="group grid gap-3 border-t border-border/80 bg-panel-inset px-4 py-4 transition-colors duration-150 first:border-t-0 hover:bg-panel-active"
                to={`/projects/${project.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="text-base font-semibold tracking-[-0.02em] text-foreground">
                      {project.name}
                    </p>
                    <p className="text-sm text-secondary">
                      {project.description ?? "No description recorded yet."}
                    </p>
                  </div>
                  <Badge tone="neutral">{project.state}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                  <p className="qb-meta-label">Last updated {formatDateTime(project.updatedAt)}</p>
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground">
                    Open Mission Control
                  </span>
                </div>
              </Link>
            ))}
            {projectCount === 0 ? (
              <div className="qb-data-row">
                <p className="text-lg font-semibold tracking-[-0.02em]">No projects yet.</p>
                <p className="mt-2 text-sm text-secondary">
                  Create a project to connect a repository, complete setup, and continue
                  overview and user-flow planning.
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </section>
    </AppFrame>
  );
};
