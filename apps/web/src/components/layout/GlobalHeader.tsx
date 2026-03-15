import type { User } from "@quayboard/shared";
import { Link, NavLink } from "react-router-dom";

import { Button } from "../ui/Button.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition",
    isActive
      ? "border-accent/55 bg-accent/12 text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-panel/80 hover:text-foreground",
  ].join(" ");

const plainLinkClassName =
  "rounded-md border border-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:border-border hover:bg-panel/80 hover:text-foreground";

export const GlobalHeader = ({
  isSigningOut = false,
  onSignOut,
  projectsHref,
  user,
}: {
  isSigningOut?: boolean;
  onSignOut?: () => void;
  projectsHref: string;
  user: User | null;
}) => (
  <header className="rounded-[calc(var(--radius)+4px)] border border-border/90 bg-card/95 px-4 py-4 shadow-harbor md:px-5">
    <div className="flex flex-wrap items-center gap-4">
      <Link className="group flex min-w-[14rem] flex-none items-center gap-3" to={projectsHref}>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-accent/45 bg-accent/12 font-mono text-sm font-semibold tracking-[0.18em] text-foreground">
          QB
        </span>
        <span>
          <span className="block font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Control Plane
          </span>
          <span className="block font-display text-xl tracking-tight text-foreground group-hover:text-white">
            Quayboard
          </span>
        </span>
      </Link>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Link className={plainLinkClassName} to={projectsHref}>
          Projects
        </Link>
        <NavLink className={navLinkClassName} to="/docs">
          Docs
        </NavLink>
        {user ? (
          <NavLink className={navLinkClassName} to="/settings">
            Settings
          </NavLink>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {user ? (
          <>
            <div className="rounded-md border border-border/90 bg-panel/80 px-3 py-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Operator
              </p>
              <p className="text-sm font-semibold text-foreground">{user.displayName}</p>
            </div>
            <Button disabled={isSigningOut} onClick={onSignOut} variant="ghost">
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link className={plainLinkClassName} to="/login">
              Sign in
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-md border border-accent/55 bg-accent/16 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:bg-accent/26"
              to="/register"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </div>
  </header>
);
