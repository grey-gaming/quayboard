import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAutoAdvanceService } from "../../src/services/auto-advance.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-01-01T00:00:00.000Z");

const makeSessionRow = (
  overrides: Partial<{
    id: string;
    status: string;
    currentStep: string | null;
    pausedReason: string | null;
    autoApproveWhenClear: boolean;
    skipReviewSteps: boolean;
    creativityMode: string;
    startedAt: Date | null;
    pausedAt: Date | null;
    completedAt: Date | null;
  }> = {},
) => ({
  id: SESSION_ID,
  projectId: PROJECT_ID,
  status: "idle" as const,
  currentStep: null,
  pausedReason: null,
  autoApproveWhenClear: false,
  skipReviewSteps: false,
  creativityMode: "balanced",
  startedAt: null,
  pausedAt: null,
  completedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeProject = () => ({
  id: PROJECT_ID,
  ownerUserId: USER_ID,
  name: "Test Project",
  description: null,
  state: "READY" as const,
  onePagerApprovedAt: null,
  userFlowsApprovedAt: null,
  userFlowsApprovalSnapshot: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const makeJob = (projectId = PROJECT_ID) => ({
  id: JOB_ID,
  projectId,
  type: "GenerateProjectOverview",
  status: "succeeded" as const,
  inputs: {},
  outputs: null,
  error: null,
  parentJobId: null,
  dependencyJobId: null,
  createdByUserId: USER_ID,
  queuedAt: NOW,
  startedAt: NOW,
  completedAt: NOW,
});

const makeDb = (overrides: Partial<{
  session: ReturnType<typeof makeSessionRow> | null;
  project: ReturnType<typeof makeProject> | null;
  job: ReturnType<typeof makeJob> | null;
}> = {}) => {
  const session = overrides.session !== undefined ? overrides.session : null;
  const project = overrides.project !== undefined ? overrides.project : makeProject();
  const job = overrides.job !== undefined ? overrides.job : makeJob();

  const insertReturning = vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const, startedAt: NOW })]);
  const updateReturning = vi.fn().mockImplementation(async () => [makeSessionRow()]);

  return {
    query: {
      autoAdvanceSessionsTable: {
        findFirst: vi.fn().mockResolvedValue(session),
      },
      projectsTable: {
        findFirst: vi.fn().mockResolvedValue(project),
      },
      jobsTable: {
        findFirst: vi.fn().mockResolvedValue(job),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: insertReturning }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: updateReturning }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    insertReturning,
    updateReturning,
  };
};

describe("auto-advance service", () => {
  let nextActionsService: { build: ReturnType<typeof vi.fn> };
  let jobService: { createJob: ReturnType<typeof vi.fn> };
  let sseHub: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    nextActionsService = {
      build: vi.fn().mockResolvedValue({
        actions: [
          {
            key: "overview",
            label: "Generate the overview document",
            href: `/projects/${PROJECT_ID}/one-pager`,
          },
        ],
      }),
    };
    jobService = {
      createJob: vi.fn().mockResolvedValue({ id: JOB_ID }),
    };
    sseHub = {
      publish: vi.fn(),
    };
  });

  describe("getStatus", () => {
    it("returns null session when no session exists", async () => {
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session).toBeNull();
      expect(result.nextStep).toBe("overview");
    });

    it("returns the existing session when one exists", async () => {
      const existingSession = makeSessionRow({ status: "running" as const });
      const db = makeDb({ session: existingSession });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session?.id).toBe(SESSION_ID);
      expect(result.session?.status).toBe("running");
    });

    it("returns null nextStep when no actions are queued", async () => {
      nextActionsService.build.mockResolvedValue({ actions: [] });
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.nextStep).toBeNull();
    });
  });

  describe("start", () => {
    it("creates a new session and enqueues the next job", async () => {
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.start(USER_ID, PROJECT_ID, {});

      expect(db.insert).toHaveBeenCalled();
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateProjectOverview",
          projectId: PROJECT_ID,
        }),
      );
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("throws when session is already running", async () => {
      const runningSession = makeSessionRow({ status: "running" as const });
      const db = makeDb({ session: runningSession });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await expect(service.start(USER_ID, PROJECT_ID, {})).rejects.toThrow();
    });

    it("pauses with needs_human when next action is not automatable", async () => {
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "overview_approval",
            label: "Approve the overview document",
            href: `/projects/${PROJECT_ID}/one-pager`,
          },
        ],
      });
      const db = makeDb({ session: null });
      // Capture the update calls
      const updates: Array<{ status?: string; pausedReason?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; pausedReason?: string }) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).not.toHaveBeenCalled();
      const pauseUpdate = updates.find((u) => u.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("needs_human");
    });

    it("marks completed when no actions remain", async () => {
      nextActionsService.build.mockResolvedValue({ actions: [] });
      const db = makeDb({ session: null });
      const completedUpdates: Array<{ status?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string }) => {
          completedUpdates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).not.toHaveBeenCalled();
      const completedUpdate = completedUpdates.find((u) => u.status === "completed");
      expect(completedUpdate).toBeDefined();
    });
  });

  describe("stop", () => {
    it("pauses a running session with manual_pause", async () => {
      const runningSession = makeSessionRow({ status: "running" as const });
      const db = makeDb({ session: runningSession });
      const pauseUpdates: Array<{ status?: string; pausedReason?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; pausedReason?: string }) => {
          pauseUpdates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause" })]) }) };
        }),
      });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      const result = await service.stop(USER_ID, PROJECT_ID);

      expect(pauseUpdates[0]?.status).toBe("paused");
      expect(pauseUpdates[0]?.pausedReason).toBe("manual_pause");
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("throws when no running session exists", async () => {
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await expect(service.stop(USER_ID, PROJECT_ID)).rejects.toThrow();
    });
  });

  describe("resume", () => {
    it("resumes a paused session and advances to next step", async () => {
      const pausedSession = makeSessionRow({
        status: "paused" as const,
        pausedReason: "manual_pause",
      });
      // First call returns paused session, second call (inside advanceStep) returns running
      let callCount = 0;
      const db = makeDb({ session: pausedSession });
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return pausedSession;
        return makeSessionRow({ status: "running" as const });
      });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.resume(USER_ID, PROJECT_ID);

      expect(jobService.createJob).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("throws when no paused session exists", async () => {
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await expect(service.resume(USER_ID, PROJECT_ID)).rejects.toThrow();
    });
  });

  describe("reset", () => {
    it("deletes the session and publishes SSE event", async () => {
      const db = makeDb({ session: makeSessionRow() });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.reset(USER_ID, PROJECT_ID);

      expect(db.delete).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
    });
  });

  describe("onJobComplete", () => {
    it("pauses session with job_failed on job failure", async () => {
      const runningSession = makeSessionRow({ status: "running" as const });
      const db = makeDb({ session: runningSession, job: makeJob() });
      const failureUpdates: Array<{ status?: string; pausedReason?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; pausedReason?: string }) => {
          failureUpdates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.onJobComplete(JOB_ID, "failure");

      const pauseUpdate = failureUpdates.find((u) => u.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("job_failed");
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("advances to next step on job success", async () => {
      const runningSession = makeSessionRow({ status: "running" as const });
      const db = makeDb({ session: runningSession, job: makeJob() });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.onJobComplete(JOB_ID, "success");

      expect(nextActionsService.build).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("does nothing when no running session exists for the job's project", async () => {
      const db = makeDb({ session: null, job: makeJob() });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).not.toHaveBeenCalled();
      expect(sseHub.publish).not.toHaveBeenCalled();
    });

    it("does nothing when job has no projectId", async () => {
      const jobWithNoProject = { ...makeJob(), projectId: null };
      const db = makeDb({ session: null, job: jobWithNoProject as never });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.onJobComplete(JOB_ID, "failure");

      expect(db.update).not.toHaveBeenCalled();
      expect(sseHub.publish).not.toHaveBeenCalled();
    });
  });

  describe("AUTOMATABLE_STEPS mapping", () => {
    it("enqueues GenerateDecisionDeck with kind:ux for ux_decisions_generate", async () => {
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "ux_decisions_generate",
            label: "Generate the UX decision tiles",
            href: `/projects/${PROJECT_ID}/ux-spec`,
          },
        ],
      });
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateDecisionDeck",
          inputs: { kind: "ux" },
        }),
      );
    });

    it("extracts featureId from href for feature_product_create", async () => {
      const featureId = "55555555-5555-4555-8555-555555555555";
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "feature_product_create",
            label: "Author the first feature Product Spec",
            href: `/projects/${PROJECT_ID}/features/${featureId}`,
          },
        ],
      });
      const db = makeDb({ session: null });
      const service = createAutoAdvanceService(
        db as never,
        nextActionsService as never,
        jobService as never,
        sseHub as never,
      );

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureProductSpec",
          inputs: { featureId },
        }),
      );
    });
  });
});
