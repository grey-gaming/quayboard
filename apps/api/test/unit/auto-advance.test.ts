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
    autoResolveAmbiguousReconciliation: boolean;
    creativityMode: string;
    retryCount: number;
    reviewCount: number;
    ambiguousReconciliationRepairCount: number;
    maxConcurrentJobs: number;
    pendingJobCount: number;
    activeBatchToken: string | null;
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
  autoResolveAmbiguousReconciliation: false,
  creativityMode: "balanced",
  retryCount: 0,
  reviewCount: 0,
  ambiguousReconciliationRepairCount: 0,
  maxConcurrentJobs: 1,
  pendingJobCount: 0,
  activeBatchToken: null,
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
  inputs: {
    _autoAdvance: {
      sessionId: SESSION_ID,
      batchToken: "batch-1",
    },
  },
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
      milestonesTable: {
        findFirst: vi.fn().mockResolvedValue(null),
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
  let nextActionsService: { build: ReturnType<typeof vi.fn>; buildBatch: ReturnType<typeof vi.fn> };
  let jobService: {
    cancelActiveAutoAdvanceJobsForProject: ReturnType<typeof vi.fn>;
    createJob: ReturnType<typeof vi.fn>;
  };
  let sseHub: { publish: ReturnType<typeof vi.fn> };
  let artifactApprovalService: { approve: ReturnType<typeof vi.fn> };
  let blueprintService: {
    listDecisionCards: ReturnType<typeof vi.fn>;
    updateDecisionCards: ReturnType<typeof vi.fn>;
    acceptDecisionDeck: ReturnType<typeof vi.fn>;
    getCanonicalByKind: ReturnType<typeof vi.fn>;
  };
  let milestoneService: {
    getActiveMilestone: ReturnType<typeof vi.fn>;
    incrementAutoCatchUpCount: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    recordReconciliationResult: ReturnType<typeof vi.fn>;
    transition: ReturnType<typeof vi.fn>;
  };
  let onePagerService: { approveCanonical: ReturnType<typeof vi.fn> };
  let productSpecService: { approveCanonical: ReturnType<typeof vi.fn> };
  let featureWorkstreamService: { getTracks: ReturnType<typeof vi.fn>; approveRevision: ReturnType<typeof vi.fn> };
  let userFlowService: { list: ReturnType<typeof vi.fn>; approve: ReturnType<typeof vi.fn> };
  let taskPlanningService: { autoAnswerClarifications: ReturnType<typeof vi.fn>; getOrCreateSession: ReturnType<typeof vi.fn> };

  const makeService = (db: ReturnType<typeof makeDb>) =>
    createAutoAdvanceService(
      db as never,
      nextActionsService as never,
      jobService as never,
      sseHub as never,
      artifactApprovalService as never,
      blueprintService as never,
      milestoneService as never,
      onePagerService as never,
      productSpecService as never,
      featureWorkstreamService as never,
      userFlowService as never,
      taskPlanningService as never,
    );

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
      buildBatch: vi.fn().mockImplementation(async (userId: string, projectId: string) => {
        // Delegate to build for test simplicity — returns a single-action batch
        const result = await nextActionsService.build(userId, projectId);
        return { actions: result.actions.slice(0, 1) };
      }),
    };
    jobService = {
      cancelActiveAutoAdvanceJobsForProject: vi.fn().mockResolvedValue([]),
      createJob: vi.fn().mockResolvedValue({ id: JOB_ID }),
    };
    sseHub = {
      publish: vi.fn(),
    };
    artifactApprovalService = { approve: vi.fn().mockResolvedValue(undefined) };
    blueprintService = {
      listDecisionCards: vi.fn().mockResolvedValue({ cards: [] }),
      updateDecisionCards: vi.fn().mockResolvedValue({ cards: [] }),
      acceptDecisionDeck: vi.fn().mockResolvedValue({ cards: [] }),
      getCanonicalByKind: vi.fn().mockResolvedValue(null),
    };
    milestoneService = {
      list: vi.fn().mockResolvedValue({ milestones: [] }),
      getActiveMilestone: vi.fn().mockResolvedValue(null),
      recordReconciliationResult: vi.fn().mockResolvedValue(undefined),
      incrementAutoCatchUpCount: vi.fn().mockResolvedValue(undefined),
      transition: vi.fn().mockResolvedValue(undefined),
    };
    onePagerService = { approveCanonical: vi.fn().mockResolvedValue(undefined) };
    productSpecService = { approveCanonical: vi.fn().mockResolvedValue(undefined) };
    featureWorkstreamService = {
      getTracks: vi.fn().mockResolvedValue({ tracks: { product: { status: "draft", headRevision: null } } }),
      approveRevision: vi.fn().mockResolvedValue(undefined),
    };
    userFlowService = {
      list: vi.fn().mockResolvedValue({ userFlows: [], coverage: { warnings: [] }, approvedAt: null }),
      approve: vi.fn().mockResolvedValue(undefined),
    };
    taskPlanningService = {
      autoAnswerClarifications: vi.fn().mockResolvedValue(undefined),
      getOrCreateSession: vi.fn().mockResolvedValue({ id: "session-id" }),
    };
  });

  describe("getStatus", () => {
    it("returns null session when no session exists", async () => {
      const db = makeDb({ session: null });
      const service = makeService(db);

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session).toBeNull();
      expect(result.nextStep).toBe("overview");
    });

    it("returns the existing session when one exists", async () => {
      const existingSession = makeSessionRow({ status: "running" as const });
      const db = makeDb({ session: existingSession });
      const service = makeService(db);

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session?.id).toBe(SESSION_ID);
      expect(result.session?.status).toBe("running");
    });

    it("returns null nextStep when no actions are queued", async () => {
      nextActionsService.build.mockResolvedValue({ actions: [] });
      const db = makeDb({ session: null });
      const service = makeService(db);

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.nextStep).toBeNull();
    });
  });

  describe("start", () => {
    it("creates a new session and enqueues the next job", async () => {
      const db = makeDb({ session: null });
      const service = makeService(db);

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
      const service = makeService(db);

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
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).not.toHaveBeenCalled();
      const pauseUpdate = updates.find((u) => u.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("needs_human");
    });

    it("enqueues ReviewDelivery when no actions remain", async () => {
      nextActionsService.build.mockResolvedValue({ actions: [] });
      const db = makeDb({ session: null });
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ReviewDelivery", projectId: PROJECT_ID }),
      );
    });

    it("marks completed (not another review) when no actions remain and reviewCount >= 3", async () => {
      nextActionsService.build.mockResolvedValue({ actions: [] });
      const sessionWithMaxReviews = makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", reviewCount: 3 });
      // First call: returns paused session for resume(); second call inside advanceStep: returns the same (reviewCount still 3)
      let callCount = 0;
      const db = makeDb({ session: sessionWithMaxReviews });
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return sessionWithMaxReviews;
        return makeSessionRow({ status: "running" as const, reviewCount: 3 });
      });
      const completedUpdates: Array<{ status?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string }) => {
          completedUpdates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

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
      const service = makeService(db);

      const result = await service.stop(USER_ID, PROJECT_ID);

      expect(pauseUpdates[0]?.status).toBe("paused");
      expect(pauseUpdates[0]?.pausedReason).toBe("manual_pause");
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("throws when no running session exists", async () => {
      const db = makeDb({ session: null });
      const service = makeService(db);

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
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(jobService.createJob).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("throws when no paused session exists", async () => {
      const db = makeDb({ session: null });
      const service = makeService(db);

      await expect(service.resume(USER_ID, PROJECT_ID)).rejects.toThrow();
    });
  });

  describe("reset", () => {
    it("deletes the session and publishes SSE event", async () => {
      const db = makeDb({ session: makeSessionRow() });
      const service = makeService(db);

      await service.reset(USER_ID, PROJECT_ID);

      expect(jobService.cancelActiveAutoAdvanceJobsForProject).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        error: expect.objectContaining({ code: "auto_advance_reset" }),
      });
      expect(db.delete).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
    });
  });

  describe("onJobComplete", () => {
    it("retries on failure when retryCount < 3", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        retryCount: 0,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "GenerateFeatureTechSpec",
        inputs: {
          featureId: "feature-123",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: failedJob });
      const updates: Array<{ status?: string; retryCount?: number; pendingJobCount?: number; activeBatchToken?: string | null }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; retryCount?: number; pendingJobCount?: number; activeBatchToken?: string | null }) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const })]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      // Should increment retryCount (no pause)
      const retryUpdate = updates.find((u) => u.retryCount !== undefined);
      expect(retryUpdate?.retryCount).toBe(1);
      expect(retryUpdate?.pendingJobCount).toBe(1);
      expect(retryUpdate?.activeBatchToken).toBeUndefined();
      expect(updates.find((u) => u.status === "paused")).toBeUndefined();
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureTechSpec",
          projectId: PROJECT_ID,
          inputs: expect.objectContaining({
            featureId: "feature-123",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
              batchToken: "batch-1",
            }),
          }),
        }),
      );
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("pauses session with job_failed on the third consecutive failure", async () => {
      const failedJob = {
        ...makeJob(),
        inputs: {
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
            retryAttempt: 2,
          },
        },
      };
      const runningSession = makeSessionRow({
        status: "running" as const,
        activeBatchToken: "batch-1",
      });
      const db = makeDb({ session: runningSession, job: failedJob });
      const failureUpdates: Array<{ status?: string; pausedReason?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; pausedReason?: string }) => {
          failureUpdates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      const pauseUpdate = failureUpdates.find((u) => u.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("job_failed");
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("uses per-job retry metadata instead of the session retry count", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        retryCount: 2,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "GenerateFeatureTechSpec",
        inputs: {
          featureId: "feature-123",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: failedJob });
      const updates: Array<{ status?: string; retryCount?: number; pendingJobCount?: number }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(
          (data: { status?: string; retryCount?: number; pendingJobCount?: number }) => {
            updates.push(data);
            return {
              where: vi
                .fn()
                .mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }),
            };
          },
        ),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      expect(updates.find((update) => update.status === "paused")).toBeUndefined();
      expect(updates.find((update) => update.retryCount === 1)).toBeDefined();
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureTechSpec",
          inputs: expect.objectContaining({
            featureId: "feature-123",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
              batchToken: "batch-1",
              retryAttempt: 1,
            }),
          }),
        }),
      );
    });

    it("advances to next step on job success and resets retryCount", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        retryCount: 2,
        activeBatchToken: "batch-1",
      });
      const db = makeDb({ session: runningSession, job: makeJob() });
      const updates: Array<{ retryCount?: number }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { retryCount?: number }) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const })]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(nextActionsService.buildBatch).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
      const resetUpdate = updates.find((u) => "retryCount" in u && u.retryCount === 0);
      expect(resetUpdate).toBeDefined();
    });

    it("marks session completed when ReviewDelivery reports complete:true", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        reviewCount: 1,
        activeBatchToken: "batch-1",
      });
      const reviewJob = { ...makeJob(), type: "ReviewDelivery", outputs: { complete: true, issues: [] } as never };
      const db = makeDb({ session: runningSession, job: reviewJob });
      const updates: Array<{ status?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string }) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      const completedUpdate = updates.find((u) => u.status === "completed");
      expect(completedUpdate).toBeDefined();
      expect(jobService.createJob).not.toHaveBeenCalled();
    });

    it("enqueues fix job when ReviewDelivery reports issues and reviewCount < 3", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        reviewCount: 1,
        activeBatchToken: "batch-1",
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewDelivery",
        outputs: {
          complete: false,
          issues: [{ jobType: "GenerateUseCases", hint: "Missing onboarding flow" }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }),
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateUseCases",
          inputs: expect.objectContaining({ hint: "Missing onboarding flow" }),
        }),
      );
    });

    it("pauses with review_limit_reached when ReviewDelivery reports issues and reviewCount >= 3", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        reviewCount: 3,
        activeBatchToken: "batch-1",
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewDelivery",
        outputs: {
          complete: false,
          issues: [{ jobType: "GenerateMilestones", hint: "Missing milestones" }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      const updates: Array<{ status?: string; pausedReason?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; pausedReason?: string }) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      const pauseUpdate = updates.find((u) => u.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("review_limit_reached");
      expect(jobService.createJob).not.toHaveBeenCalled();
    });

    it("reruns ReviewDelivery after resuming from a review-limit pause", async () => {
      const pausedSession = makeSessionRow({
        status: "paused" as const,
        currentStep: "delivery_review",
        pausedReason: "review_limit_reached",
        reviewCount: 3,
      });
      const resumedSession = makeSessionRow({
        status: "running" as const,
        currentStep: "delivery_review",
        reviewCount: 3,
      });
      nextActionsService.buildBatch.mockResolvedValue({ actions: [] });
      const db = makeDb({ session: pausedSession });
      db.query.autoAdvanceSessionsTable.findFirst = vi
        .fn()
        .mockResolvedValueOnce(pausedSession)
        .mockResolvedValueOnce(resumedSession);
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                resumedSession,
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ReviewDelivery",
          projectId: PROJECT_ID,
          inputs: expect.objectContaining({
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
      expect(updates.some((update) => update.status === "completed")).toBe(false);
    });

    it("queues a milestone feature-set rewrite when reconciliation finds a first-pass gap", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneCoverage",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues: [{ action: "rewrite_feature_set", hint: "Missing milestone docs." }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
          autoCatchUpCount: 0,
        }),
      } as never;
      const updates: Array<Record<string, unknown>> = [];
      let updateCall = 0;
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          updateCall += 1;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: "running" as const,
                  pendingJobCount: updateCall === 1 ? 0 : 1,
                  activeBatchToken: "batch-1",
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.recordReconciliationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          milestoneId: "milestone-1",
          status: "failed_first_pass",
        }),
      );
      expect(milestoneService.incrementAutoCatchUpCount).toHaveBeenCalledWith("milestone-1");
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RewriteMilestoneFeatureSet",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            hint: "Missing milestone docs.",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("pauses when milestone reconciliation still has gaps after the rewrite limit", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneCoverage",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues: [{ action: "rewrite_feature_set", hint: "Still missing milestone docs." }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
          autoCatchUpCount: 1,
        }),
      } as never;
      const updates: Array<Record<string, unknown>> = [];
      let updateCall = 0;
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          updateCall += 1;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: updateCall === 2 ? ("paused" as const) : ("running" as const),
                  pendingJobCount: 0,
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.recordReconciliationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          milestoneId: "milestone-1",
          status: "failed_needs_human",
        }),
      );
      expect(jobService.createJob).not.toHaveBeenCalled();
      const pauseUpdate = updates.find((update) => update.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("needs_human");
    });

    it("queues an ambiguous reconciliation repair when enabled for the session", async () => {
      const issues = [
        { action: "needs_human_review", hint: "Clarify governance evidence." },
        { action: "needs_human_review", hint: "Clarify legal copy scope." },
      ];
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoResolveAmbiguousReconciliation: true,
        ambiguousReconciliationRepairCount: 0,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneCoverage",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues,
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
          autoCatchUpCount: 0,
        }),
      } as never;
      const updates: Array<Record<string, unknown>> = [];
      let updateCall = 0;
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          updateCall += 1;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: "running" as const,
                  pendingJobCount: updateCall === 1 ? 0 : 1,
                  activeBatchToken: "batch-2",
                  autoResolveAmbiguousReconciliation: true,
                  ambiguousReconciliationRepairCount: 1,
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.recordReconciliationResult).not.toHaveBeenCalled();
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ResolveMilestoneCoverageIssues",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            issues,
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
      expect(
        updates.some(
          (update) => update.ambiguousReconciliationRepairCount === 1 && update.pendingJobCount === 1,
        ),
      ).toBe(true);
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("continues into normal feature planning after a milestone feature-set rewrite succeeds", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const catchUpJob = {
        ...makeJob(),
        type: "RewriteMilestoneFeatureSet",
      };
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "feature_product_create",
            label: "Author the first feature Product Spec",
            href: `/projects/${PROJECT_ID}/features/feature-123`,
          },
        ],
      });
      const db = makeDb({ session: runningSession, job: catchUpJob });
      let updateCall = 0;
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((_data: Record<string, unknown>) => {
          updateCall += 1;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: "running" as const,
                  pendingJobCount: updateCall === 1 ? 0 : 1,
                  activeBatchToken: "batch-1",
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureProductSpec",
          inputs: expect.objectContaining({
            featureId: "feature-123",
          }),
        }),
      );
    });

    it("pauses when an ambiguous reconciliation repair still reports unresolved gaps", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const repairJob = {
        ...makeJob(),
        type: "ResolveMilestoneCoverageIssues",
        outputs: {
          resolved: false,
          unresolvedReasons: ["Still requires a manual scope decision."],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: repairJob });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: "paused" as const,
                  pausedReason: "needs_human",
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).not.toHaveBeenCalled();
      expect(nextActionsService.buildBatch).not.toHaveBeenCalled();
      expect(
        updates.some(
          (update) => update.status === "paused" && update.pausedReason === "needs_human",
        ),
      ).toBe(true);
    });

    it("advances after an ambiguous reconciliation repair resolves the blocking issues", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const repairJob = {
        ...makeJob(),
        type: "ResolveMilestoneCoverageIssues",
        outputs: {
          resolved: true,
          operationsApplied: [],
        } as never,
      };
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "milestone_reconciliation_review",
            label: "Rerun milestone reconciliation",
            href: `/projects/${PROJECT_ID}/milestones/milestone-1`,
          },
        ],
      });
      const db = makeDb({ session: runningSession, job: repairJob });
      let updateCall = 0;
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((_data: Record<string, unknown>) => {
          updateCall += 1;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: "running" as const,
                  pendingJobCount: updateCall === 1 ? 0 : 1,
                  activeBatchToken: "batch-1",
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ReviewMilestoneCoverage",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
    });

    it("does nothing when no running session exists for the job's project", async () => {
      const db = makeDb({ session: null, job: makeJob() });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).not.toHaveBeenCalled();
      expect(sseHub.publish).not.toHaveBeenCalled();
    });

    it("does nothing when job has no projectId", async () => {
      const jobWithNoProject = { ...makeJob(), projectId: null };
      const db = makeDb({ session: null, job: jobWithNoProject as never });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      expect(db.update).not.toHaveBeenCalled();
      expect(sseHub.publish).not.toHaveBeenCalled();
    });
    it("ignores completions from an older batch after resume", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 2,
        activeBatchToken: "new-batch",
      });
      const staleJob = {
        ...makeJob(),
        inputs: {
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "old-batch",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: staleJob });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(db.update).not.toHaveBeenCalled();
      expect(nextActionsService.buildBatch).not.toHaveBeenCalled();
      expect(jobService.createJob).not.toHaveBeenCalled();
    });
  });

  describe("parallel batch dispatch", () => {
    it("enqueues multiple jobs when buildBatch returns multiple actions", async () => {
      const featureId1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const featureId2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      nextActionsService.buildBatch.mockResolvedValue({
        actions: [
          { key: "feature_product_create", label: "Author Product Spec", href: `/projects/${PROJECT_ID}/features/${featureId1}` },
          { key: "feature_product_create", label: "Author Product Spec", href: `/projects/${PROJECT_ID}/features/${featureId2}` },
        ],
      });
      const db = makeDb({ session: makeSessionRow({ maxConcurrentJobs: 2, status: "paused" as const, pausedReason: "manual_pause" }) });
      let callCount = 0;
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", maxConcurrentJobs: 2 });
        return makeSessionRow({ status: "running" as const, maxConcurrentJobs: 2 });
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(jobService.createJob).toHaveBeenCalledTimes(2);
      expect(jobService.createJob).toHaveBeenCalledWith(expect.objectContaining({
        type: "GenerateFeatureProductSpec",
        inputs: expect.objectContaining({ featureId: featureId1 }),
      }));
      expect(jobService.createJob).toHaveBeenCalledWith(expect.objectContaining({
        type: "GenerateFeatureProductSpec",
        inputs: expect.objectContaining({ featureId: featureId2 }),
      }));
    });

    it("does not advance when pendingJobCount > 0 after job success, but resets retryCount", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        retryCount: 2,
        pendingJobCount: 2,
        activeBatchToken: "batch-1",
      });
      const db = makeDb({ session: runningSession, job: makeJob() });
      const updates: Array<{ retryCount?: number }> = [];
      // Decrement returns pendingJobCount: 1 (still > 0)
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { retryCount?: number }) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ pendingJobCount: 1 })]) }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(nextActionsService.buildBatch).not.toHaveBeenCalled();
      expect(jobService.createJob).not.toHaveBeenCalled();
      expect(updates.find((u) => u.retryCount === 0)).toBeDefined();
    });

    it("retries the failed job when other parallel jobs are still pending", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 3,
        retryCount: 0,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "GenerateFeatureTechSpec",
        inputs: {
          featureId: "feature-456",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: failedJob });
      const updates: Array<{ status?: string; pausedReason?: string; retryCount?: number; pendingJobCount?: number }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: { status?: string; pausedReason?: string; retryCount?: number; pendingJobCount?: number }) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ pendingJobCount: 2 })]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      expect(updates.find((u) => u.status === "paused")).toBeUndefined();
      const retryUpdate = updates.find((u) => u.retryCount === 1);
      expect(retryUpdate?.pendingJobCount).toBe(3);
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureTechSpec",
          inputs: expect.objectContaining({
            featureId: "feature-456",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
              batchToken: "batch-1",
            }),
          }),
        }),
      );
      expect(nextActionsService.buildBatch).not.toHaveBeenCalled();
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
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateDecisionDeck",
          inputs: expect.objectContaining({ kind: "ux" }),
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
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureProductSpec",
          inputs: expect.objectContaining({ featureId }),
        }),
      );
    });

    it("queues AutoAnswerTaskClarifications once with auto-advance metadata", async () => {
      const featureId = "66666666-6666-4666-8666-666666666666";
      const taskSessionId = "77777777-7777-4777-8777-777777777777";
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "feature_task_clarifications_answer",
            label: "Answer task clarifications",
            href: `/projects/${PROJECT_ID}/features/${featureId}?taskSession=${taskSessionId}`,
          },
        ],
      });
      const db = makeDb({ session: null });
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(taskPlanningService.autoAnswerClarifications).not.toHaveBeenCalled();
      expect(jobService.createJob).toHaveBeenCalledTimes(1);
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AutoAnswerTaskClarifications",
          projectId: PROJECT_ID,
          inputs: expect.objectContaining({
            featureId,
            sessionId: taskSessionId,
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
    });
  });

  describe("milestones_approve catch narrowing (Bug 1)", () => {
    it("propagates non-HttpError exceptions from milestone transition", async () => {
      // build() returns milestones_approve on first call; after the error the test ends
      let buildCallCount = 0;
      nextActionsService.buildBatch.mockImplementation(async () => {
        buildCallCount++;
        if (buildCallCount === 1) {
          return {
            actions: [{
              key: "milestones_approve",
              label: "Approve a milestone",
              href: `/projects/${PROJECT_ID}/milestones`,
            }],
          };
        }
        return { actions: [] };
      });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "m1",
        status: "draft",
      });
      milestoneService.transition.mockRejectedValue(new Error("DB connection failed"));

      const session = makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", autoApproveWhenClear: true });
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockResolvedValue(
        makeSessionRow({ status: "running" as const, autoApproveWhenClear: true }),
      );
      // First call returns paused for the resume guard check
      db.query.autoAdvanceSessionsTable.findFirst
        .mockResolvedValueOnce(session);
      const service = makeService(db);

      await expect(service.resume(USER_ID, PROJECT_ID)).rejects.toThrow("DB connection failed");
    });

    it("approves only the active milestone when milestones_approve is auto-handled", async () => {
      let buildCallCount = 0;
      nextActionsService.buildBatch.mockImplementation(async () => {
        buildCallCount++;
        if (buildCallCount === 1) {
          return {
            actions: [{
              key: "milestones_approve",
              label: "Approve a milestone",
              href: `/projects/${PROJECT_ID}/milestones`,
            }],
          };
        }
        return { actions: [] };
      });
      milestoneService.getActiveMilestone
        .mockResolvedValueOnce({
          id: "m1",
          status: "draft",
        })
        .mockResolvedValue(undefined);
      milestoneService.transition.mockResolvedValue(undefined);

      const session = makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", autoApproveWhenClear: true });
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockResolvedValue(
        makeSessionRow({ status: "running" as const, autoApproveWhenClear: true }),
      );
      db.query.autoAdvanceSessionsTable.findFirst
        .mockResolvedValueOnce(session);
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(milestoneService.transition).toHaveBeenCalledTimes(1);
      expect(milestoneService.transition).toHaveBeenCalledWith(USER_ID, "m1", {
        action: "approve",
      });
    });
  });

  describe("pendingJobCount for delivery review (Bug 2)", () => {
    it("sets pendingJobCount to 1 when dispatching ReviewDelivery", async () => {
      nextActionsService.build.mockResolvedValue({ actions: [] });
      const session = makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", reviewCount: 0 });
      let callCount = 0;
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return session;
        return makeSessionRow({ status: "running" as const, reviewCount: 0 });
      });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      const reviewUpdate = updates.find((u) => u.currentStep === "delivery_review");
      expect(reviewUpdate?.pendingJobCount).toBe(1);
    });

    it("sets pendingJobCount to 1 before creating fix job from review issues", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        reviewCount: 1,
        activeBatchToken: "batch-1",
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewDelivery",
        outputs: {
          complete: false,
          issues: [{ jobType: "GenerateUseCases", hint: "Missing flow" }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      const pendingUpdate = updates.find((u) => u.pendingJobCount === 1);
      expect(pendingUpdate).toBeDefined();
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({ type: "GenerateUseCases" }),
      );
    });
  });

  describe("reviewCount preserved on restart (Bug 3)", () => {
    it("does not reset reviewCount when restarting an existing session", async () => {
      const existingSession = makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", reviewCount: 2 });
      const db = makeDb({ session: existingSession });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const })]) }) };
        }),
      });
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      // The first update is the restart — verify no reviewCount reset
      const restartUpdate = updates.find((u) => u.status === "running");
      expect(restartUpdate).toBeDefined();
      expect(restartUpdate).not.toHaveProperty("reviewCount");
    });
  });

  describe("feature approval regex warning (Bug 6)", () => {
    it("returns false and warns when href does not contain featureId", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "feature_product_approval",
            label: "Approve a feature Product Spec",
            href: `/projects/${PROJECT_ID}/milestones/some-id`,
          },
        ],
      });

      const session = makeSessionRow({ status: "paused" as const, pausedReason: "manual_pause", autoApproveWhenClear: true });
      let callCount = 0;
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return session;
        return makeSessionRow({ status: "running" as const, autoApproveWhenClear: true });
      });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow()]) }) };
        }),
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not extract featureId"));
      const pauseUpdate = updates.find((u) => u.pausedReason === "needs_human");
      expect(pauseUpdate).toBeDefined();
      warnSpy.mockRestore();
    });
  });
});
