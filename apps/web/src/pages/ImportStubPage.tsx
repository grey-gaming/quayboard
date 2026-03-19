import { AppFrame } from "../components/templates/AppFrame.js";
import { CenteredState } from "../components/composites/CenteredState.js";

export const ImportStubPage = () => (
  <AppFrame>
    <CenteredState
      title="Import Path Not Yet Available"
      body="Repository import is not available yet. Start from scratch to continue with the current workflow."
    />
  </AppFrame>
);
