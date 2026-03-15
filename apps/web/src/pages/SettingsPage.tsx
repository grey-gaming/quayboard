import { Link } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Card } from "../components/ui/Card.js";

export const SettingsPage = () => (
  <AppFrame>
    <PageIntro
      eyebrow="Workspace"
      title="Settings"
      summary="Manage instance-level controls that affect the current Quayboard workspace."
    />
    <Card className="max-w-2xl">
      <p className="text-sm text-muted-foreground">Instance</p>
      <p className="mt-2 text-xl font-semibold">Instance Readiness</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Review deployment prerequisites such as database connectivity, encryption, Docker,
        artifact storage, and enabled provider adapters.
      </p>
      <Link
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
        to="/setup/instance"
      >
        Open Instance Readiness
      </Link>
    </Card>
  </AppFrame>
);
