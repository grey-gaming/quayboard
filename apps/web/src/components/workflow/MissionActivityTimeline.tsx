import type { Job } from "@quayboard/shared";
import { Link } from "react-router-dom";

import { formatDateTime, formatJobType } from "../../lib/format.js";
import { getJobErrorMessage } from "./LatestJobFailureAlert.js";
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
  projectId,
  limit = 8,
}: {
  jobs: Job[];
  projectId: string;
  limit?: number;
}) => {
  const visible = jobs.slice(0, limit);

  return (
    <Card surface="rail" className="h-fit">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <p className="qb-meta-label">History</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Activity</p>
        </div>
        <Badge tone="neutral">{jobs.length} events</Badge>
      </div>
      <div className="mt-4 grid gap-2">
        {visible.map((job) => (
          <Link
            key={job.id}
            className="rounded-sm border border-border/80 bg-panel-inset px-3 py-2 text-sm transition-colors hover:bg-panel"
            to={`/projects/${projectId}/live/${job.id}`}
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
            {(job.status === "failed" || job.status === "cancelled") && (() => {
              const msg = getJobErrorMessage(job);
              return msg ? (
                <p className="mt-0.5 text-xs text-danger/80 leading-snug">{msg}</p>
              ) : null;
            })()}
          </Link>
        ))}
        {jobs.length === 0 && (
          <div className="rounded-sm border border-border/80 bg-panel-inset px-3 py-2 text-sm text-secondary">
            No activity recorded yet.
          </div>
        )}
      </div>
    </Card>
  );
};
