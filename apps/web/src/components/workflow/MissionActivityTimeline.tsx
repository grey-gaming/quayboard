import type { Job } from "@quayboard/shared";

import { formatDateTime, formatJobType } from "../../lib/format.js";
import { Badge } from "../ui/Badge.js";
import { Card } from "../ui/Card.js";

const jobTone = (
  status: string,
): "info" | "success" | "warning" | "danger" | "neutral" => {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
    case "cancelled":
      return "danger";
    case "running":
      return "info";
    default:
      return "neutral";
  }
};

export const MissionActivityTimeline = ({
  jobs,
  limit = 8,
}: {
  jobs: Job[];
  limit?: number;
}) => {
  const visible = jobs.slice(0, limit);

  return (
    <Card surface="rail" className="h-fit w-full max-w-80">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <p className="qb-meta-label">History</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Activity</p>
        </div>
        <Badge tone="neutral">{jobs.length} events</Badge>
      </div>
      <div className="mt-4 grid gap-0 border border-border/80">
        {visible.map((job) => (
          <div
            key={job.id}
            className="grid gap-1 border-t border-border/80 bg-panel-inset px-4 py-3 text-sm first:border-t-0"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p
                className="min-w-0 flex-1 truncate font-medium tracking-[-0.02em]"
                title={formatJobType(job.type)}
              >
                {formatJobType(job.type)}
              </p>
              <Badge tone={jobTone(job.status)}>{job.status}</Badge>
            </div>
            <p className="qb-meta-label">
              {job.completedAt
                ? formatDateTime(job.completedAt)
                : job.startedAt
                  ? formatDateTime(job.startedAt)
                  : formatDateTime(job.queuedAt)}
            </p>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="qb-data-row text-sm text-secondary">
            No activity recorded yet.
          </div>
        )}
      </div>
    </Card>
  );
};
