import type { User } from "@quayboard/shared";
import { Link, NavLink } from "react-router-dom";

import { Button } from "../ui/Button.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "qb-nav-cell",
    isActive
      ? "border-accent/55 bg-accent/12 text-foreground"
      : "text-secondary hover:border-border hover:bg-panel-inset hover:text-foreground",
  ].join(" ");

const plainLinkClassName =
  "qb-nav-cell text-secondary hover:border-border hover:bg-panel-inset hover:text-foreground";

const primaryLinkClassName =
  "inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover";

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
  <header className="border border-border/90 bg-panel px-4 py-4 md:px-5">
    <div className="flex flex-wrap items-start gap-4">
      <Link aria-label="Quayboard" className="group flex flex-none items-center gap-3" to={projectsHref}>
        <span className="inline-flex h-10 w-10 items-center justify-center border border-accent/55 bg-panel-inset font-mono text-sm font-semibold tracking-[0.18em] text-foreground">
          QB
        </span>
        <span className="block font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground group-hover:text-white">
          Quayboard
        </span>
      </Link>
      <div className="flex min-w-[16rem] flex-1 flex-wrap items-center gap-2">
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
            <div className="border border-border/90 bg-panel-inset px-3 py-2">
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
