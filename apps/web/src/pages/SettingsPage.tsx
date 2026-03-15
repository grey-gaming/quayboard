import { Link } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";

export const SettingsPage = () => (
  <AppFrame>
    <PageIntro
      eyebrow="Workspace"
      title="Settings"
      summary="Manage instance-level controls that affect the current Quayboard workspace."
      meta={
        <>
          <Badge tone="info">instance controls</Badge>
          <Badge tone="warning">operator access</Badge>
        </>
      }
    />
    <Card className="max-w-3xl" surface="rail">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Instance
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight">Instance Readiness</p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Review deployment prerequisites such as database connectivity, encryption, Docker,
        artifact storage, and enabled provider adapters.
      </p>
      <Link
        className="mt-6 inline-flex items-center justify-center rounded-md border border-accent/55 bg-accent/16 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:bg-accent/26"
        to="/setup/instance"
      >
        Open Instance Readiness
      </Link>
    </Card>
  </AppFrame>
);
