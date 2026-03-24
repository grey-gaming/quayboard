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
          await onFailure(job.id, {
            message: error instanceof Error ? error.message : "Job execution failed.",
          });
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
