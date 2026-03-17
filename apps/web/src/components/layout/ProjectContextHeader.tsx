import type { Project, ProjectSetupStatus } from "@quayboard/shared";
import { NavLink } from "react-router-dom";

import { Badge } from "../ui/Badge.js";

const projectNavItems = [
  { label: "Mission Control", suffix: "" },
  { label: "Project Setup", suffix: "/setup" },
  { label: "Overview", suffix: "/one-pager" },
  { label: "User Flows", suffix: "/user-flows" },
  { label: "Import", suffix: "/import" },
];

export const ProjectContextHeader = ({
  project,
  setupStatus,
}: {
  project: Project;
  setupStatus: ProjectSetupStatus | undefined;
}) => {
  const setupReady =
    setupStatus?.repoConnected && setupStatus.llmVerified && setupStatus.sandboxVerified;

  return (
    <div className="grid gap-4 border border-border/90 bg-panel-inset px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{project.state}</Badge>
            <Badge tone={setupReady ? "success" : "warning"}>
              {setupReady ? "setup ready" : "setup in progress"}
            </Badge>
          </div>
          <div className="grid gap-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Active Project
            </p>
            <p className="text-[1.4rem] font-semibold tracking-[-0.02em]">{project.name}</p>
            <p className="max-w-3xl text-sm text-secondary">
              {project.description ??
                "Project-scoped planning and setup workspace for the current delivery surface."}
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
        {projectNavItems.map((item) => (
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
            end={item.suffix === ""}
            to={`/projects/${project.id}${item.suffix}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
};
