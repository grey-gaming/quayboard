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

  const loop = async () => {
    if (!active) {
      return;
    }

    const job = await getNextJob();

    if (!job) {
      timer = setTimeout(() => {
        void loop();
      }, onIdleDelayMs);
      return;
    }

    try {
      await execute({ job });
    } catch (error) {
      await onFailure(job.id, {
        message: error instanceof Error ? error.message : "Job execution failed.",
      });
    }

    timer = setTimeout(() => {
      void loop();
    }, 0);
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
