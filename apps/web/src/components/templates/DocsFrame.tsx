import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useLogoutMutation, useOptionalCurrentUserQuery } from "../../hooks/use-auth.js";
import type { DocsEntry } from "../../lib/docs-content.js";
import { GlobalHeader } from "../layout/GlobalHeader.js";
import { Card } from "../ui/Card.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "block rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition",
    isActive
      ? "border-accent/50 bg-accent/12 text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-panel/80 hover:text-foreground",
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
    <div className="min-h-screen px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <GlobalHeader
          isSigningOut={logoutMutation.isPending}
          onSignOut={() => {
            void logoutMutation.mutateAsync();
          }}
          projectsHref={currentUserQuery.data?.user ? "/" : "/login"}
          user={currentUserQuery.data?.user ?? null}
        />
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Documentation
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Guides</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Product-facing documentation for the current Quayboard workflow and control-plane rules.
          </p>
        </Card>
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit space-y-2" surface="rail">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
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
            <div className="rounded-md border border-border/80 bg-panel/82 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {activeSlug ? "Guide" : "Overview"} / {activeSlug || "home"}
            </div>
            <article className="space-y-4">{children}</article>
          </Card>
        </div>
      </div>
    </div>
  );
};
