import type { Project, ProjectSetupStatus } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";

export const ProjectContextHeader = ({
  project,
  setupStatus,
}: {
  project: Project;
  setupStatus: ProjectSetupStatus | undefined;
}) => (
  <div className="rounded-[calc(var(--radius)+4px)] border border-border/60 bg-background/60 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <Badge>{project.state}</Badge>
      <span className="text-sm text-muted-foreground">{project.name}</span>
      <span className="text-sm text-muted-foreground">
        Setup:{" "}
        {setupStatus?.repoConnected && setupStatus.llmVerified && setupStatus.sandboxVerified
          ? "ready"
          : "in progress"}
      </span>
    </div>
  </div>
);
