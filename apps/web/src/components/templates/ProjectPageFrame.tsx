import type { Project } from "@quayboard/shared";
import type { ReactNode } from "react";

import { useProjectJobsQuery } from "../../hooks/use-projects.js";
import {
  ProjectNavigationStack,
} from "../layout/ProjectNavigationStack.js";
import type {
  ProjectNavSection,
  ProjectTertiaryNavItem,
} from "../layout/project-navigation.js";
import { AppFrame } from "./AppFrame.js";

const RECENT_FAIL_MS = 5 * 60 * 1000;

export const ProjectPageFrame = ({
  activeSection,
  children,
  project,
  tertiaryItems,
}: {
  activeSection: ProjectNavSection;
  children: ReactNode;
  project: Project;
  tertiaryItems?: ProjectTertiaryNavItem[];
}) => {
  const jobsQuery = useProjectJobsQuery(project.id);
  const jobs = jobsQuery.data?.jobs ?? [];

  const activeJobCount = jobs.filter((j) => j.status === "running").length;
  const pendingJobCount = jobs.filter((j) => j.status === "queued").length;
  const hasActiveJob = activeJobCount > 0 || pendingJobCount > 0;

  const now = Date.now();
  const recentFailedCount = jobs.filter(
    (j) =>
      j.status === "failed" &&
      j.completedAt &&
      now - new Date(j.completedAt).getTime() <= RECENT_FAIL_MS,
  ).length;

  return (
    <AppFrame
      subHeader={
        <ProjectNavigationStack
          activeSection={activeSection}
          project={project}
          tertiaryItems={tertiaryItems}
          hasActiveJob={hasActiveJob}
          activeJobCount={activeJobCount}
          pendingJobCount={pendingJobCount}
          recentFailedCount={recentFailedCount}
        />
      }
    >
      {children}
    </AppFrame>
  );
};
