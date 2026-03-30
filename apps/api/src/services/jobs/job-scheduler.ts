import type { Job } from "@quayboard/shared";

type JobExecutionContext = {
  job: Job;
};

export type JobExecutor = (context: JobExecutionContext) => Promise<unknown>;

export type JobSchedulerOptions = {
  execute: JobExecutor;
  getNextJob: () => Promise<Job | null>;
  onFailure: (jobId: string, error: unknown) => Promise<void>;
  maxConcurrent?: number;
  onIdleDelayMs?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const toFailurePayload = (error: unknown) => {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (
      "jobError" in record &&
      record.jobError &&
      typeof record.jobError === "object" &&
      "message" in (record.jobError as Record<string, unknown>) &&
      typeof (record.jobError as Record<string, unknown>).message === "string"
    ) {
      return record.jobError;
    }

    if ("message" in record && typeof record.message === "string") {
      return {
        message: record.message,
        ...("code" in record && typeof record.code === "string"
          ? { code: record.code }
          : {}),
        ...("category" in record && typeof record.category === "string"
          ? { category: record.category }
          : {}),
        ...("templateId" in record && typeof record.templateId === "string"
          ? { templateId: record.templateId }
          : {}),
        ...("doneReason" in record &&
        (typeof record.doneReason === "string" || record.doneReason === null)
          ? { doneReason: record.doneReason }
          : {}),
        ...("retryable" in record && typeof record.retryable === "boolean"
          ? { retryable: record.retryable }
          : {}),
      };
    }
  }

  return {
    message: error instanceof Error ? error.message : "Job execution failed.",
  };
};

export const createJobScheduler = ({
  execute,
  getNextJob,
  onFailure,
  maxConcurrent = 1,
  onIdleDelayMs = 250,
}: JobSchedulerOptions) => {
  let active = false;

  const runSlot = async () => {
    while (active) {
      let job: Job | null = null;

      try {
        job = await getNextJob();
      } catch (error) {
        console.error("Job scheduler poll failed.", error);
        await sleep(onIdleDelayMs);
        continue;
      }

      if (!job) {
        await sleep(onIdleDelayMs);
        continue;
      }

      try {
        await execute({ job });
      } catch (error) {
        try {
          await onFailure(job.id, toFailurePayload(error));
        } catch (failureError) {
          console.error("Failed to mark job as failed.", failureError);
        }
      }
    }
  };

  return {
    start() {
      if (active) {
        return;
      }

      active = true;

      for (let i = 0; i < maxConcurrent; i++) {
        void runSlot();
      }
    },
    stop() {
      active = false;
    },
  };
};

export type JobScheduler = ReturnType<typeof createJobScheduler>;
