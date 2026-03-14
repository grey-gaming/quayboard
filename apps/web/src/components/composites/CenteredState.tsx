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
    <Card className="max-w-lg text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  </div>
);
