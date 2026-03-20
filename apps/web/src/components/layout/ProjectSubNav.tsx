import type { Project } from "@quayboard/shared";
import { NavLink } from "react-router-dom";

import { isSetupCompletedProjectState } from "../../lib/project-state.js";

const projectNavItems = [
  { label: "Mission Control", suffix: "", end: true },
  { label: "Project Setup", suffix: "/setup", end: true },
  { label: "Questions", suffix: "/questions", end: true, requiresSetupCompletion: true },
  { label: "Overview", suffix: "/one-pager", end: true, requiresSetupCompletion: true },
  { label: "Product Spec", suffix: "/product-spec", end: true, requiresSetupCompletion: true },
  { label: "UX Spec", suffix: "/ux-spec", end: true, requiresSetupCompletion: true },
  { label: "Technical Spec", suffix: "/technical-spec", end: true, requiresSetupCompletion: true },
  { label: "User Flows", suffix: "/user-flows", end: true, requiresSetupCompletion: true },
  { label: "Import", suffix: "/import", end: true, requiresSetupCompletion: true },
];

export const ProjectSubNav = ({ project }: { project: Project }) => {
  const setupCompleted = isSetupCompletedProjectState(project.state);

  return (
    <div className="grid gap-4 border border-border/90 bg-panel-inset px-4 py-4">
      <div className="border-b border-border/80 pb-4">
        <p className="text-[1.4rem] font-semibold tracking-[-0.02em]">{project.name}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {projectNavItems.map((item) => {
          const isLocked = item.requiresSetupCompletion && !setupCompleted;

          if (isLocked) {
            return (
              <span
                key={item.label}
                aria-disabled="true"
                className="qb-nav-cell cursor-not-allowed border-border/60 bg-panel text-muted-foreground opacity-70"
                title="Complete setup to unlock this section."
              >
                {item.label}
              </span>
            );
          }

          return (
            <NavLink
              key={item.label}
              className={({ isActive }) =>
                [
                  "qb-nav-cell",
                  isActive
                    ? "border-accent/55 bg-accent/12 text-foreground"
                    : "border-border/70 bg-panel text-secondary hover:border-border-strong hover:text-foreground",
                ].join(" ")
              }
              end={item.end}
              to={`/projects/${project.id}${item.suffix}`}
            >
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
