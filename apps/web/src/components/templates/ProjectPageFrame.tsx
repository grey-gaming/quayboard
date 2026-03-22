import type { Project } from "@quayboard/shared";
import type { ReactNode } from "react";

import {
  ProjectNavigationStack,
} from "../layout/ProjectNavigationStack.js";
import type {
  ProjectNavSection,
  ProjectTertiaryNavItem,
} from "../layout/project-navigation.js";
import { AppFrame } from "./AppFrame.js";

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
}) => (
  <AppFrame
    subHeader={
      <ProjectNavigationStack
        activeSection={activeSection}
        project={project}
        tertiaryItems={tertiaryItems}
      />
    }
  >
    {children}
  </AppFrame>
);
