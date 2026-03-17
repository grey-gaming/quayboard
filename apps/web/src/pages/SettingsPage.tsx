import { Link } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";

const primaryLinkClassName =
  "inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-background transition-colors duration-150 hover:border-accent-hover hover:bg-accent-hover";

export const SettingsPage = () => (
  <AppFrame>
    <PageIntro
      eyebrow="Instance"
      title="Settings"
      summary="Manage instance-level controls for the current Quayboard instance."
      meta={
        <>
          <Badge tone="neutral">instance controls</Badge>
          <Badge tone="warning">operator access</Badge>
        </>
      }
    />
    <Card className="max-w-4xl" surface="panel">
      <p className="qb-meta-label">Instance</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">Instance Readiness</p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
        Review deployment prerequisites such as database connectivity, encryption, Docker,
        artifact storage, and enabled provider adapters.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <div className="qb-kv">
          <p className="qb-meta-label">Controls</p>
          <p className="text-sm text-foreground">Deployment checks and remediation guidance</p>
        </div>
        <div className="qb-kv">
          <p className="qb-meta-label">Audience</p>
          <p className="text-sm text-foreground">Operators managing the local Quayboard instance</p>
        </div>
      </div>
      <div className="mt-5">
        <Link className={primaryLinkClassName} to="/setup/instance">
          Open Instance Readiness
        </Link>
      </div>
    </Card>
  </AppFrame>
);
