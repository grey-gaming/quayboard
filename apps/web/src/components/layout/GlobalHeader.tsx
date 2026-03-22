import type { User } from "@quayboard/shared";
import { Link, NavLink } from "react-router-dom";

import { Button } from "../ui/Button.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "qb-global-nav-cell",
    isActive
      ? "border-accent/70 bg-accent/18 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.16)]"
      : "border-accent/15 bg-panel text-secondary hover:border-accent/35 hover:bg-panel-active hover:text-foreground",
  ].join(" ");

const plainLinkClassName =
  "qb-global-nav-cell border-accent/15 bg-panel text-secondary hover:border-accent/35 hover:bg-panel-active hover:text-foreground";

const primaryLinkClassName =
  "inline-flex min-h-9 items-center justify-center border border-accent/90 bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover";

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
  <header className="border border-accent/15 bg-panel-raised px-3 py-3 shadow-[inset_0_1px_0_hsl(var(--accent)/0.05)] md:px-4 md:py-3.5">
    <div className="flex flex-wrap items-start gap-3">
      <Link aria-label="Quayboard" className="group flex flex-none items-center gap-3" to={projectsHref}>
        <span className="inline-flex h-9 w-9 items-center justify-center border border-accent/70 bg-accent/12 font-mono text-sm font-semibold tracking-[0.18em] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.12)]">
          QB
        </span>
        <span className="block font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground group-hover:text-white">
          Quayboard
        </span>
      </Link>
      <div className="flex min-w-[16rem] flex-1 flex-wrap items-center gap-1.5">
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
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {user ? (
          <>
            <div className="border border-accent/15 bg-panel px-3 py-2">
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
            <Link className={primaryLinkClassName} to="/register">
              Register
            </Link>
          </>
        )}
      </div>
    </div>
  </header>
);
