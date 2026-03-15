import type { User } from "@quayboard/shared";
import { Link, NavLink } from "react-router-dom";

import { Button } from "../ui/Button.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-sm transition",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/70",
  ].join(" ");

const plainLinkClassName =
  "rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/70";

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
  <header className="rounded-[calc(var(--radius)+10px)] border border-border/60 bg-card/60 px-4 py-3 shadow-harbor backdrop-blur md:px-5">
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-1 justify-start">
        <Link className={plainLinkClassName} to={projectsHref}>
          Projects
        </Link>
      </div>
      <div className="min-w-[10rem] flex-none text-center">
        <p className="font-display text-xl tracking-tight md:text-2xl">Quayboard</p>
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <NavLink className={navLinkClassName} to="/docs">
          Docs
        </NavLink>
        {user ? (
          <>
            <NavLink className={navLinkClassName} to="/settings">
              Settings
            </NavLink>
            <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm font-medium">
              {user.displayName}
            </div>
            <Button disabled={isSigningOut} onClick={onSignOut} variant="secondary">
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link className={plainLinkClassName} to="/login">
              Sign in
            </Link>
            <Link
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
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
