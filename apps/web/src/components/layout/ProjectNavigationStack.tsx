import type { Project } from "@quayboard/shared";
import { Link, NavLink } from "react-router-dom";

import {
  type ProjectNavSection,
  type ProjectTertiaryNavItem,
  getSetupCompletion,
} from "./project-navigation.js";

const titleLabelClassName =
  "qb-project-nav-title max-w-[11rem] truncate md:max-w-[16rem]";

const secondaryActiveClassName = "qb-project-nav-cell-secondary-active";

const secondaryIdleClassName = "qb-project-nav-cell-secondary-idle";

const tertiaryActiveClassName = "qb-project-nav-cell-tertiary-active";

const tertiaryIdleClassName = "qb-project-nav-cell-tertiary-idle";

const disabledClassName = "qb-project-nav-cell-disabled";

const linkClassName = ({
  isActive,
}: {
  isActive: boolean;
}) =>
  [
    "qb-project-nav-cell",
    isActive ? tertiaryActiveClassName : tertiaryIdleClassName,
  ].join(" ");

const secondaryLinkClassName = (isActive: boolean, extra?: string) =>
  [
    "qb-project-nav-cell",
    isActive ? secondaryActiveClassName : secondaryIdleClassName,
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");

const renderTertiaryItem = (item: ProjectTertiaryNavItem) => {
  if (item.kind === "label") {
    return (
      <span
        key={item.key}
        className={[
          "qb-project-nav-label",
          item.truncate ? "max-w-[11rem] truncate md:max-w-[16rem]" : "",
        ].join(" ")}
        title={item.title}
      >
        {item.label}
      </span>
    );
  }

  if (item.kind === "disabled") {
    return (
      <span
        key={item.key}
        aria-disabled="true"
        className={["qb-project-nav-cell", disabledClassName].join(" ")}
        title={item.title}
      >
        {item.label}
      </span>
    );
  }

  if (item.kind === "button") {
    return (
      <button
        key={item.key}
        className={[
          "qb-project-nav-cell",
          item.active ? tertiaryActiveClassName : tertiaryIdleClassName,
          item.disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
        disabled={item.disabled}
        onClick={() => {
          if (!item.disabled) {
            item.onClick();
          }
        }}
        type="button"
      >
        {item.label}
      </button>
    );
  }

  if (item.disabled) {
    return (
      <span
        key={item.key}
        aria-disabled="true"
        className={["qb-project-nav-cell", disabledClassName].join(" ")}
        title={item.title}
      >
        {item.label}
      </span>
    );
  }

  return (
    <NavLink key={item.key} className={linkClassName} end={item.end} title={item.title} to={item.to}>
      {item.label}
    </NavLink>
  );
};

export const ProjectNavigationStack = ({
  activeSection,
  project,
  tertiaryItems = [],
  hasActiveJob = false,
  activeJobCount = 0,
  pendingJobCount = 0,
  recentFailedCount = 0,
}: {
  activeSection: ProjectNavSection;
  project: Project;
  tertiaryItems?: ProjectTertiaryNavItem[];
  hasActiveJob?: boolean;
  activeJobCount?: number;
  pendingJobCount?: number;
  recentFailedCount?: number;
}) => {
  const setupCompleted = getSetupCompletion(project);

  return (
    <div className="qb-project-nav-stack -mt-px">
      <div className="qb-project-nav-row border-b border-border/70">
        <span className={titleLabelClassName} title={project.name}>
          {project.name}
        </span>
        <Link
          className={secondaryLinkClassName(
            activeSection === "mission-control",
            hasActiveJob ? "qb-nav-ai-active" : undefined,
          )}
          to={`/projects/${project.id}`}
        >
          Mission Control
        </Link>
        <Link className={secondaryLinkClassName(activeSection === "setup")} to={`/projects/${project.id}/setup`}>
          Setup
        </Link>
        {setupCompleted ? (
          <Link
            className={secondaryLinkClassName(activeSection === "product-design")}
            to={`/projects/${project.id}/one-pager`}
          >
            Product Design
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={["qb-project-nav-cell", disabledClassName].join(" ")}
            title="Complete setup to unlock this section."
          >
            Product Design
          </span>
        )}
        {setupCompleted ? (
          <Link
            className={secondaryLinkClassName(activeSection === "feature-design")}
            to={`/projects/${project.id}/features`}
          >
            Feature Design
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={["qb-project-nav-cell", disabledClassName].join(" ")}
            title="Complete setup to unlock this section."
          >
            Feature Design
          </span>
        )}
        <span
          aria-disabled="true"
          className={["qb-project-nav-cell", disabledClassName].join(" ")}
          title="Implementation is not available yet."
        >
          Implementation
        </span>
        {(activeJobCount > 0 || pendingJobCount > 0 || recentFailedCount > 0) && (
          <div className="ml-auto flex items-center gap-1.5">
            {activeJobCount > 0 && (
              <span className="qb-meta-label text-info">
                {activeJobCount} active
              </span>
            )}
            {pendingJobCount > 0 && (
              <span className="qb-meta-label text-secondary">
                {pendingJobCount} pending
              </span>
            )}
            {recentFailedCount > 0 && (
              <span className="qb-meta-label text-danger">
                {recentFailedCount} failed
              </span>
            )}
          </div>
        )}
      </div>
      {tertiaryItems.length ? <div className="qb-project-nav-row">{tertiaryItems.map(renderTertiaryItem)}</div> : null}
    </div>
  );
};
