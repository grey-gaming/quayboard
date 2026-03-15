import type { ReactNode } from "react";

import { Card } from "../ui/Card.js";

export const CenteredState = ({
  action,
  body,
  title,
}: {
  action?: ReactNode;
  body: string;
  title: string;
}) => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Card className="max-w-xl text-center" surface="rail">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Status
      </p>
      <h2 className="mt-2 font-display text-2xl tracking-tight">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  </div>
);
