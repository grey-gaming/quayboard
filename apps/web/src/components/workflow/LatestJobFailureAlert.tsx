import type { Job } from "@quayboard/shared";

import { formatDateTime } from "../../lib/format.js";
import { Alert } from "../ui/Alert.js";

const relevantJobTimestamp = (job: Job) => job.completedAt ?? job.startedAt ?? job.queuedAt;
const terminalFailureStatuses = new Set(["failed", "cancelled"]);
const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);

export const findLatestJob = (
  jobs: Job[] | undefined,
  predicate: (job: Job) => boolean,
) =>
  (jobs ?? [])
    .filter(predicate)
    .sort((left, right) => relevantJobTimestamp(right).localeCompare(relevantJobTimestamp(left)))[0] ?? null;

export const findLatestFailedJob = (
  jobs: Job[] | undefined,
  predicate: (job: Job) => boolean,
) => {
  const latestTerminalJob = findLatestJob(
    jobs,
    (job) => predicate(job) && terminalStatuses.has(job.status),
  );

  return latestTerminalJob && terminalFailureStatuses.has(latestTerminalJob.status)
    ? latestTerminalJob
    : null;
};

export const getJobErrorMessage = (job: Job) =>
  typeof job.error === "object" &&
  job.error !== null &&
  "message" in job.error &&
  typeof job.error.message === "string"
    ? job.error.message
    : null;

export const getDefaultJobFailureHint = (message: string, workflowLabel: string) => {
  if (message.includes("job_interrupted_by_server_restart")) {
    return `The API restarted before ${workflowLabel} finished. Restart the API, confirm it is healthy, then queue the job again.`;
  }

  if (message.includes("job_interrupted_by_server_shutdown")) {
    return `The API shut down before ${workflowLabel} finished. Start it again, confirm it is healthy, then queue the job again.`;
  }

  return `Review the failure details, adjust the source inputs if needed, then retry ${workflowLabel}.`;
};

export const LatestJobFailureAlert = ({
  currentVersionStillAvailable = false,
  hint,
  job,
  workflowLabel,
}: {
  currentVersionStillAvailable?: boolean;
  hint?: string | null;
  job: Job | null;
  workflowLabel: string;
}) => {
  if (!job) {
    return null;
  }

  const message = getJobErrorMessage(job);

  if (!message) {
    return null;
  }

  return (
    <Alert tone="error">
      <p className="font-medium">{workflowLabel} failed.</p>
      <p className="mt-1">{message}</p>
      {hint ? <p className="mt-1">{hint}</p> : null}
      <p className="mt-1 text-secondary">
        Last attempt {formatDateTime(relevantJobTimestamp(job))}.
        {currentVersionStillAvailable ? " The current canonical version is still available below." : ""}
      </p>
    </Alert>
  );
};
