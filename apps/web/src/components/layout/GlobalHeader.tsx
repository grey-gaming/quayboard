import { useEffect, useState } from "react";
import type { User } from "@quayboard/shared";
import { Link, NavLink, useLocation } from "react-router-dom";

import { AiAutomationRunIcon } from "../ui/AiAutomationRunIcon.js";
import { Button } from "../ui/Button.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [
    "qb-global-nav-cell",
    isActive ? "qb-global-nav-cell-active" : "qb-global-nav-cell-idle",
  ].join(" ");

const plainLinkClassName = "qb-global-nav-cell qb-global-nav-cell-idle";

const primaryLinkClassName = "qb-global-action-link";

const mobileNavButtonClassName = "qb-global-nav-cell qb-global-nav-cell-idle md:hidden";

const ProfileIcon = () => (
  <svg
    aria-hidden="true"
    className="h-3.5 w-3.5 shrink-0"
    fill="none"
    viewBox="0 0 16 16"
  >
    <circle cx="8" cy="5.25" r="2.5" stroke="currentColor" strokeWidth="1.25" />
    <path
      d="M3.25 13c.6-2.2 2.34-3.5 4.75-3.5s4.15 1.3 4.75 3.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.25"
    />
  </svg>
);

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
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="qb-global-header px-3 py-3 md:px-4 md:py-3.5">
      <div className="flex items-center justify-between gap-3">
        <Link
          aria-label="Quayboard"
          className="group flex min-w-0 flex-none items-center gap-3"
          to={projectsHref}
        >
          <span className="qb-global-brand-mark">
            <AiAutomationRunIcon className="h-7 w-7" />
          </span>
          <span className="block font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-[hsl(var(--nav-primary-text))] group-hover:text-white">
            Quayboard
          </span>
        </Link>
        <button
          aria-controls="mobile-global-nav"
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation"
          className={mobileNavButtonClassName}
          onClick={() => setMobileMenuOpen((open) => !open)}
          type="button"
        >
          <span className="sr-only">Navigation</span>
          <svg
            aria-hidden="true"
            className={`h-3.5 w-3.5 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M3.5 6.25 8 10.75l4.5-4.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
        <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-between gap-3 md:flex">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:gap-4">
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
                <div className="qb-global-user-chip">
                  <ProfileIcon />
                  <p>{user.displayName}</p>
                </div>
                <Button
                  className="qb-global-signout"
                  disabled={isSigningOut}
                  onClick={onSignOut}
                  variant="ghost"
                >
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
      </div>
      {mobileMenuOpen ? (
        <div
          className="mt-3 grid gap-2 border-t border-[hsl(var(--nav-primary-text)/0.18)] pt-3 md:hidden"
          id="mobile-global-nav"
        >
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
          {user ? (
            <>
              <div className="qb-global-user-chip w-fit">
                <ProfileIcon />
                <p>{user.displayName}</p>
              </div>
              <Button
                className="qb-global-signout justify-start"
                disabled={isSigningOut}
                onClick={onSignOut}
                variant="ghost"
              >
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
      ) : null}
    </header>
  );
};
