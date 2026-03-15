import { Link } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Card } from "../components/ui/Card.js";
import { useProjectsQuery } from "../hooks/use-projects.js";

export const ProtectedHomePage = () => {
  const projectsQuery = useProjectsQuery();

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Workspace"
        title="Projects"
        summary="Manage scratch-path onboarding from project creation through overview and user-flow approval."
      />
      <section className="grid gap-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Project workspace</p>
              <p className="text-lg font-semibold">Create a new project or continue an existing one.</p>
            </div>
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              to="/projects/new"
            >
              New Project
            </Link>
          </div>
        </Card>
        <div className="grid gap-4">
          {projectsQuery.data?.projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="hover:bg-muted/30">
                <p className="font-semibold">{project.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.description ?? "No description yet."}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {project.state}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </AppFrame>
  );
};
