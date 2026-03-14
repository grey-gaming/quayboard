import { Link } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useCurrentUserQuery, useLogoutMutation } from "../hooks/use-auth.js";
import { useProjectsQuery } from "../hooks/use-projects.js";

export const ProtectedHomePage = () => {
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const projectsQuery = useProjectsQuery();

  if (currentUserQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  const user = currentUserQuery.data?.user;

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
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="text-lg font-semibold">{user?.displayName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex gap-3">
              <Link
                className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
                to="/projects/new"
              >
                New Project
              </Link>
              <Button
                disabled={logoutMutation.isPending}
                onClick={() => {
                  void logoutMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Sign out
              </Button>
            </div>
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
