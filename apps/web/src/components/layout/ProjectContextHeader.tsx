import type { Project, ProjectSetupStatus } from "@quayboard/shared";
import { NavLink } from "react-router-dom";

import { isSetupCompletedProjectState } from "../../lib/project-state.js";
import { Badge } from "../ui/Badge.js";

const projectNavItems = [
  { label: "Mission Control", suffix: "", end: true },
  { label: "Project Setup", suffix: "/setup", end: true },
  { label: "Questions", suffix: "/questions", end: true, requiresSetupCompletion: true },
  { label: "Overview", suffix: "/one-pager", end: true, requiresSetupCompletion: true },
  { label: "User Flows", suffix: "/user-flows", end: true, requiresSetupCompletion: true },
  { label: "Import", suffix: "/import", end: true, requiresSetupCompletion: true },
];

export const ProjectContextHeader = ({
  project,
  setupStatus,
}: {
  project: Project;
  setupStatus: ProjectSetupStatus | undefined;
}) => {
  const setupChecksPassed =
    setupStatus?.repoConnected && setupStatus.llmVerified && setupStatus.sandboxVerified;
  const setupCompleted = isSetupCompletedProjectState(project.state);
  const setupStatusBadge = setupCompleted
    ? { label: "setup complete", tone: "success" as const }
    : setupChecksPassed
      ? { label: "ready to complete", tone: "info" as const }
      : { label: "setup in progress", tone: "warning" as const };

  return (
    <div className="grid gap-4 border border-border/90 bg-panel-inset px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{project.state}</Badge>
            <Badge tone={setupStatusBadge.tone}>{setupStatusBadge.label}</Badge>
          </div>
          <div className="grid gap-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Active Project
            </p>
            <p className="text-[1.4rem] font-semibold tracking-[-0.02em]">{project.name}</p>
            <p className="max-w-3xl text-sm text-secondary">
              {project.description ??
                "Project setup and planning for the current delivery phase."}
            </p>
          </div>
        </div>
        <div className="grid min-w-[18rem] gap-2 sm:grid-cols-3">
          <div className="qb-kv">
            <p className="qb-meta-label">
              Repo
            </p>
            <p className="text-sm text-foreground">
              {setupStatus?.repoConnected ? "Connected" : "Pending"}
            </p>
          </div>
          <div className="qb-kv">
            <p className="qb-meta-label">
              LLM
            </p>
            <p className="text-sm text-foreground">
              {setupStatus?.llmVerified ? "Verified" : "Pending"}
            </p>
          </div>
          <div className="qb-kv">
            <p className="qb-meta-label">
              Sandbox
            </p>
            <p className="text-sm text-foreground">
              {setupStatus?.sandboxVerified ? "Verified" : "Pending"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
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
