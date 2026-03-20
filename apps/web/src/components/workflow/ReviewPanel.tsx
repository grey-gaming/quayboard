import type { ArtifactReviewItem } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";

const severityOrder = ["BLOCKER", "WARNING", "SUGGESTION"] as const;

const badgeToneBySeverity = {
  BLOCKER: "warning",
  WARNING: "info",
  SUGGESTION: "neutral",
} as const;

type ReviewPanelProps = {
  isUpdating?: boolean;
  items: ArtifactReviewItem[];
  onUpdate: (reviewItemId: string, status: "ACCEPTED" | "DONE" | "IGNORED") => void;
};

export const ReviewPanel = ({ isUpdating = false, items, onUpdate }: ReviewPanelProps) => (
  <Card surface="rail" className="h-fit">
    <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
      <div>
        <p className="qb-meta-label">Review</p>
        <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Review Panel</p>
      </div>
      <Badge tone="neutral">{items.length} items</Badge>
    </div>
    <div className="mt-4 grid gap-3">
      {severityOrder.map((severity) =>
        items
          .filter((item) => item.severity === severity)
          .map((item) => (
            <div key={item.id} className="border border-border/80 bg-panel-inset px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="qb-meta-label">{item.category}</p>
                </div>
                <Badge tone={badgeToneBySeverity[item.severity]}>{item.severity}</Badge>
              </div>
              <p className="mt-3 text-sm text-secondary">{item.details}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={isUpdating || item.status === "DONE"}
                  onClick={() => {
                    onUpdate(item.id, "DONE");
                  }}
                  variant="secondary"
                >
                  Mark Done
                </Button>
                <Button
                  disabled={isUpdating || item.status === "ACCEPTED"}
                  onClick={() => {
                    onUpdate(item.id, "ACCEPTED");
                  }}
                  variant="ghost"
                >
                  Accept
                </Button>
                <Button
                  disabled={isUpdating || item.status === "IGNORED"}
                  onClick={() => {
                    onUpdate(item.id, "IGNORED");
                  }}
                  variant="ghost"
                >
                  Ignore
                </Button>
                <Badge tone="neutral">{item.status}</Badge>
              </div>
            </div>
          )),
      )}
      {items.length === 0 ? (
        <div className="border border-border/80 bg-panel-inset px-4 py-4 text-sm text-secondary">
          No review items yet. Run review from the action bar when the specification is ready.
        </div>
      ) : null}
    </div>
  </Card>
);
