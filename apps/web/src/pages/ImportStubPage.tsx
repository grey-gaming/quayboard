import { CenteredState } from "../components/composites/CenteredState.js";
import { buildSetupTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { useProjectQuery } from "../hooks/use-projects.js";
import { useParams } from "react-router-dom";

export const ImportStubPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <CenteredState
          title="Import Path Not Yet Available"
          body="Repository import is not available yet. Start from scratch to continue with the current workflow."
        />
      </AppFrame>
    );
  }

  return (
    <ProjectPageFrame
      activeSection="setup"
      project={projectQuery.data}
      tertiaryItems={buildSetupTertiaryItems(projectQuery.data)}
    >
      <CenteredState
        title="Import Path Not Yet Available"
        body="Repository import is not available yet. Start from scratch to continue with the current workflow."
      />
    </ProjectPageFrame>
  );
};
