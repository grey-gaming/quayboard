import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "@quayboard/shared";

import { createJobScheduler } from "../../src/services/jobs/job-scheduler.js";

const queuedAt = "2026-03-19T00:00:00.000Z";

const createQueuedJob = (overrides: Partial<Job> = {}): Job => ({
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  type: "GenerateProjectOverview",
  status: "queued",
  inputs: {},
  outputs: null,
  error: null,
  queuedAt,
  startedAt: null,
  completedAt: null,
  ...overrides,
});

describe("job scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("keeps polling after a transient getNextJob failure", async () => {
    const getNextJob = vi
      .fn<() => Promise<Job | null>>()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(null);
    const execute = vi.fn();
    const onFailure = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scheduler = createJobScheduler({
      execute,
      getNextJob,
      onFailure,
      onIdleDelayMs: 25,
    });

    scheduler.start();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    scheduler.stop();

    expect(getNextJob.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(execute).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Job scheduler poll failed.",
      expect.any(Error),
    );
  });

  it("keeps polling after onFailure throws while marking a job failed", async () => {
    const job = createQueuedJob();
    const getNextJob = vi
      .fn<() => Promise<Job | null>>()
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(null);
    const execute = vi.fn(async () => {
      throw new Error("job execution failed");
    });
    const onFailure = vi.fn(async () => {
      throw new Error("mark failed unavailable");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scheduler = createJobScheduler({
      execute,
      getNextJob,
      onFailure,
      onIdleDelayMs: 25,
    });

    scheduler.start();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    scheduler.stop();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(job.id, {
      message: "job execution failed",
    });
    expect(getNextJob.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to mark job as failed.",
      expect.any(Error),
    );
  });
});
