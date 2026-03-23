import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useLogoutMutation, useOptionalCurrentUserQuery } from "../../hooks/use-auth.js";
import type { DocsEntry } from "../../lib/docs-content.js";
import { GlobalHeader } from "../layout/GlobalHeader.js";
import { Card } from "../ui/Card.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "qb-nav-cell flex w-full justify-between",
    isActive
      ? "border-accent/50 bg-accent/12 text-foreground"
      : "border-border/70 bg-panel-inset text-secondary hover:border-border-strong hover:text-foreground",
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
    <div className="min-h-screen px-3 py-2 md:px-4 md:py-3">
      <div className="mx-auto max-w-screen-2xl space-y-3">
        <GlobalHeader
          isSigningOut={logoutMutation.isPending}
          onSignOut={() => {
            void logoutMutation.mutateAsync();
          }}
          projectsHref={currentUserQuery.data?.user ? "/" : "/login"}
          user={currentUserQuery.data?.user ?? null}
        />
        <Card surface="rail">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Documentation
          </p>
          <h1 className="mt-3 font-display text-[1.9rem] font-semibold tracking-[-0.02em] md:text-[2.2rem]">
            Guides
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
            Product-facing documentation for the current Quayboard workflow and control-plane rules.
          </p>
        </Card>
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit space-y-2" surface="inset">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
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
          <Card className="space-y-6 p-5 md:p-6" surface="panel">
            <div className="border border-border/80 bg-panel-inset px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {activeSlug ? "Guide" : "Overview"} / {activeSlug || "home"}
            </div>
            <article className="space-y-4">{children}</article>
          </Card>
        </div>
      </div>
    </div>
  );
};
