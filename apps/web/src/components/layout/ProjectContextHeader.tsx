import type { Project, ProjectSetupStatus } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";

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
    <div className="rounded-[calc(var(--radius)+2px)] border border-border/90 bg-surface/88 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{project.state}</Badge>
            <Badge tone={setupReady ? "success" : "warning"}>
              {setupReady ? "setup ready" : "setup in progress"}
            </Badge>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Active Project
            </p>
            <p className="text-xl font-semibold tracking-tight">{project.name}</p>
          </div>
        </div>
        <div className="grid min-w-[18rem] gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border/80 bg-panel/75 px-3 py-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Repo
            </p>
            <p className="text-sm text-foreground">
              {setupStatus?.repoConnected ? "Connected" : "Pending"}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-panel/75 px-3 py-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              LLM
            </p>
            <p className="text-sm text-foreground">
              {setupStatus?.llmVerified ? "Verified" : "Pending"}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-panel/75 px-3 py-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Sandbox
            </p>
            <p className="text-sm text-foreground">
              {setupStatus?.sandboxVerified ? "Verified" : "Pending"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
