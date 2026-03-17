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
    <Card className="max-w-2xl" surface="rail">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Status
      </p>
      <div className="mt-4 grid gap-2 border-t border-border/80 pt-4">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-secondary">{body}</p>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  </div>
);
