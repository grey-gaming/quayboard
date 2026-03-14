import { AppFrame } from "../components/templates/AppFrame.js";
import { CenteredState } from "../components/composites/CenteredState.js";

export const ImportStubPage = () => (
  <AppFrame>
    <CenteredState
      title="Import Path Not Yet Available"
      body="The import chooser is visible in M2, but repository import execution lands in a later milestone."
    />
  </AppFrame>
);
