import { Link } from "react-router-dom";

import type { NextActionsResponse } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";
import { Card } from "../ui/Card.js";

export const NextActionsPanel = ({
  actions,
}: {
  actions: NextActionsResponse["actions"];
}) => (
  <Card surface="panel">
    <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
      <div>
        <p className="qb-meta-label">Queue</p>
        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Next Actions</p>
      </div>
      <Badge tone="info">current focus</Badge>
    </div>
    <div className="mt-4 grid gap-0 border border-border/80">
      {actions.map((action, index) => (
        <Link
          key={action.key}
          className={[
            "grid gap-3 border-t border-border/80 bg-panel-inset px-4 py-4 text-sm transition-colors duration-150 first:border-t-0 hover:bg-panel-active",
            index === 0 ? "border-l-2 border-l-accent" : "",
          ].join(" ")}
          to={action.href}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold tracking-[-0.02em]">{action.label}</p>
            <Badge tone={index === 0 ? "info" : "neutral"}>
              {index === 0 ? "active" : "queued"}
            </Badge>
          </div>
          <p className="qb-meta-label">
            {action.description?.trim() ? action.description : "navigation target"}
          </p>
        </Link>
      ))}
      {actions.length === 0 ? (
        <div className="qb-data-row text-sm text-secondary">
          No next actions are queued for this project yet.
        </div>
      ) : null}
    </div>
  </Card>
);
