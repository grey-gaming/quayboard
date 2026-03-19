import type { Job } from "@quayboard/shared";

type JobExecutionContext = {
  job: Job;
};

export type JobExecutor = (context: JobExecutionContext) => Promise<unknown>;

export type JobSchedulerOptions = {
  execute: JobExecutor;
  getNextJob: () => Promise<Job | null>;
  onFailure: (jobId: string, error: unknown) => Promise<void>;
  onIdleDelayMs?: number;
};

export const createJobScheduler = ({
  execute,
  getNextJob,
  onFailure,
  onIdleDelayMs = 250,
}: JobSchedulerOptions) => {
  let active = false;
  let timer: NodeJS.Timeout | null = null;

  const scheduleNext = (delayMs: number) => {
    if (!active) {
      return;
    }

    timer = setTimeout(() => {
      timer = null;
      void loop();
    }, delayMs);
  };

  const loop = async () => {
    if (!active) {
      return;
    }

    try {
      const job = await getNextJob();

      if (!job) {
        scheduleNext(onIdleDelayMs);
        return;
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
          scheduleNext(onIdleDelayMs);
          return;
        }
      }

      scheduleNext(0);
    } catch (error) {
      console.error("Job scheduler poll failed.", error);
      scheduleNext(onIdleDelayMs);
    }
  };

  return {
    start() {
      if (active) {
        return;
      }

      active = true;
      void loop();
    },
    stop() {
      active = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
};

export type JobScheduler = ReturnType<typeof createJobScheduler>;
