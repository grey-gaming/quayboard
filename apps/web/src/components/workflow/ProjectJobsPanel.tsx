import type { Job } from "@quayboard/shared";

import { formatDateTime } from "../../lib/format.js";
import { Badge } from "../ui/Badge.js";
import { Card } from "../ui/Card.js";

type ProjectJobsPanelProps = {
  className?: string;
  emptyMessage: string;
  headerBadge: string;
  jobs: Job[];
  limit?: number;
  title: string;
};

const jobTone = (status: string) =>
  status === "succeeded"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : "info";

export const ProjectJobsPanel = ({
  className = "",
  emptyMessage,
  headerBadge,
  jobs,
  limit = 5,
  title,
}: ProjectJobsPanelProps) => {
  const visibleJobs = jobs.slice(0, limit);

  return (
    <Card surface="rail" className={["h-fit", className].join(" ").trim()}>
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <p className="qb-meta-label">Background</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{title}</p>
        </div>
        <Badge tone="neutral">{headerBadge}</Badge>
      </div>
      <div className="mt-4 grid gap-0 border border-border/80">
        {visibleJobs.map((job) => (
          <div
            key={job.id}
            className="grid gap-2 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium tracking-[-0.02em]">{job.type}</p>
              <Badge tone={jobTone(job.status)}>{job.status}</Badge>
            </div>
            <p className="qb-meta-label">queued {formatDateTime(job.queuedAt)}</p>
            <p className="text-secondary">
              {job.completedAt
                ? `completed ${formatDateTime(job.completedAt)}`
                : job.startedAt
                  ? `started ${formatDateTime(job.startedAt)}`
                  : "awaiting execution"}
            </p>
          </div>
        ))}
        {jobs.length === 0 ? (
          <div className="qb-data-row text-sm text-secondary">{emptyMessage}</div>
        ) : null}
      </div>
    </Card>
  );
};
