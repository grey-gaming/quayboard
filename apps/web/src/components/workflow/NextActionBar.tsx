import type { ReactNode } from "react";

import { Card } from "../ui/Card.js";

export const NextActionBar = ({
  children,
  summary,
  title,
}: {
  children: ReactNode;
  summary: string;
  title: string;
}) => (
  <Card surface="panel">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="qb-meta-label">Next actions</p>
        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{title}</p>
        <p className="mt-2 text-sm text-secondary">{summary}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  </Card>
);
