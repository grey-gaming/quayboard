import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useLogoutMutation, useOptionalCurrentUserQuery } from "../../hooks/use-auth.js";
import type { DocsEntry } from "../../lib/docs-content.js";
import { GlobalHeader } from "../layout/GlobalHeader.js";
import { Card } from "../ui/Card.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "block rounded-lg px-3 py-2 text-sm transition",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/70",
  ].join(" ");

export const DocsFrame = ({
  activeSlug,
  children,
  guides,
}: {
  activeSlug: string;
  children: ReactNode;
  guides: DocsEntry[];
}) => {
  const currentUserQuery = useOptionalCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <GlobalHeader
          isSigningOut={logoutMutation.isPending}
          onSignOut={() => {
            void logoutMutation.mutateAsync();
          }}
          projectsHref={currentUserQuery.data?.user ? "/" : "/login"}
          user={currentUserQuery.data?.user ?? null}
        />
        <Card>
          <h1 className="font-display text-3xl tracking-tight">Guides</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Product-facing documentation for the current Quayboard workflow.
          </p>
        </Card>
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Documentation
            </p>
            <NavLink className={navLinkClassName} end to="/docs">
              Guide Home
            </NavLink>
            {guides.map((guide) => (
              <NavLink key={guide.slug} className={navLinkClassName} to={`/docs/${guide.slug}`}>
                {guide.title}
              </NavLink>
            ))}
          </Card>
          <Card className="space-y-6 p-6 md:p-8">
            <div className="rounded-2xl border border-border/60 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
              {activeSlug ? "Guide" : "Overview"} / {activeSlug || "home"}
            </div>
            <article className="space-y-4">{children}</article>
          </Card>
        </div>
      </div>
    </div>
  );
};
