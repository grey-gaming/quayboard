import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import type { DocsEntry } from "../../lib/docs-content.js";
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
}) => (
  <div className="min-h-screen px-4 py-6 md:px-6">
    <div className="mx-auto space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[calc(var(--radius)+10px)] border border-border/60 bg-card/60 px-5 py-4 shadow-harbor backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Quayboard</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">Guides</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Product-facing documentation for the current Quayboard workflow.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link className="rounded-lg px-4 py-2 text-muted-foreground hover:bg-muted/70" to="/login">
            Sign in
          </Link>
          <Link className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground" to="/register">
            Register
          </Link>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="h-fit space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
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
          <article className="space-y-4">
            {children}
          </article>
        </Card>
      </div>
    </div>
  </div>
);
