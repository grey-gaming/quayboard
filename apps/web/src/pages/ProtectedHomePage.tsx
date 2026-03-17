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
        eyebrow="Workspace"
        title="Projects"
        summary="Manage scratch-path onboarding from project creation through overview and user-flow approval."
        actions={
          <Link className={primaryLinkClassName} to="/projects/new">
            New Project
          </Link>
        }
        meta={
          <>
            <Badge tone="neutral">scratch path</Badge>
            <Badge tone={projectCount > 0 ? "success" : "warning"}>{projectCount} projects</Badge>
          </>
        }
      />
      <section className="grid gap-4">
        <Card surface="panel">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-2">
              <p className="qb-meta-label">Workspace Queue</p>
              <p className="text-xl font-semibold tracking-[-0.02em]">
                Start a new project or continue an existing planning workspace.
              </p>
              <p className="max-w-3xl text-sm leading-6 text-secondary">
                The current product surface is intentionally operational: setup, overview
                generation, and user-flow approval all live in one governed workspace.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="qb-kv">
                <p className="qb-meta-label">Projects</p>
                <p className="text-sm font-semibold text-foreground">{projectCount}</p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Current focus</p>
                <p className="text-sm text-foreground">Scratch-path planning</p>
              </div>
            </div>
          </div>
        </Card>
        <Card surface="rail">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div>
              <p className="qb-meta-label">Project Queue</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Active workspaces</p>
            </div>
            <Badge tone={projectCount > 0 ? "success" : "warning"}>
              {projectCount > 0 ? "active workspace" : "awaiting onboarding"}
            </Badge>
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
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Empty workspace
              </p>
              <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                No projects yet.
              </p>
              <p className="mt-2 text-sm text-secondary">
                Start a scratch-path project to set up repository access, generate an overview,
                and define user flows.
              </p>
              </div>
          ) : null}
          </div>
        </Card>
      </section>
    </AppFrame>
  );
};
