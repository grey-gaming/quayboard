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
    skipHumanReview: boolean;
    autoRepairMilestoneCoverage: boolean;
    creativityMode: string;
    retryCount: number;
    reviewCount: number;
    milestoneRepairCount: number;
    ciFixCount: number;
    ciWaitWindowCount: number;
    maxConcurrentJobs: number;
    pendingJobCount: number;
    activeBatchToken: string | null;
    startedAt: Date | null;
    pausedAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  }> = {},
) => ({
  id: SESSION_ID,
  projectId: PROJECT_ID,
  status: "idle" as const,
  currentStep: null,
  pausedReason: null,
  autoApproveWhenClear: false,
  skipReviewSteps: false,
  skipHumanReview: false,
  autoRepairMilestoneCoverage: false,
  creativityMode: "balanced",
  retryCount: 0,
  reviewCount: 0,
  projectReviewCount: 0,
  milestoneRepairCount: 0,
  ciFixCount: 0,
  ciWaitWindowCount: 0,
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
  milestonePlanStatus: "open" as const,
  milestonePlanFinalizedAt: null,
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
  error: null as unknown,
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
  activeJobs: Array<ReturnType<typeof makeJob>>;
}> = {}) => {
  const session = overrides.session !== undefined ? overrides.session : null;
  const project = overrides.project !== undefined ? overrides.project : makeProject();
  const job = overrides.job !== undefined ? overrides.job : makeJob();
  const activeJobs = overrides.activeJobs !== undefined ? overrides.activeJobs : [];

  const insertReturning = vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const, startedAt: NOW })]);
  const updateReturning = vi.fn().mockImplementation(async () => [makeSessionRow()]);

  return {
    query: {
      autoAdvanceSessionsTable: {
        findFirst: vi.fn().mockResolvedValue(session),
        findMany: vi.fn().mockResolvedValue(session ? [session] : []),
      },
      milestonesTable: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      projectsTable: {
        findFirst: vi.fn().mockResolvedValue(project),
      },
      jobsTable: {
        findFirst: vi.fn().mockResolvedValue(job),
        findMany: vi.fn().mockResolvedValue(activeJobs),
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
    getMilestoneMapMutationState: ReturnType<typeof vi.fn>;
    getActiveMilestone: ReturnType<typeof vi.fn>;
    incrementAutoCatchUpCount: ReturnType<typeof vi.fn>;
    invalidateDeliveryReview: ReturnType<typeof vi.fn>;
    invalidateMapReview: ReturnType<typeof vi.fn>;
    invalidateScopeReview: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    recordMapReviewResult: ReturnType<typeof vi.fn>;
    recordDeliveryReviewResult: ReturnType<typeof vi.fn>;
    recordScopeReviewResult: ReturnType<typeof vi.fn>;
    recordReconciliationResult: ReturnType<typeof vi.fn>;
    transition: ReturnType<typeof vi.fn>;
  };
  let onePagerService: { approveCanonical: ReturnType<typeof vi.fn> };
  let projectReviewService: {
    finalizeMilestonePlan: ReturnType<typeof vi.fn>;
    startReview: ReturnType<typeof vi.fn>;
  };
  let productSpecService: { approveCanonical: ReturnType<typeof vi.fn> };
  let featureWorkstreamService: { getTracks: ReturnType<typeof vi.fn>; approveRevision: ReturnType<typeof vi.fn> };
  let userFlowService: { list: ReturnType<typeof vi.fn>; approve: ReturnType<typeof vi.fn> };
  let taskPlanningService: { autoAnswerClarifications: ReturnType<typeof vi.fn>; getOrCreateSession: ReturnType<typeof vi.fn> };
  let sandboxService: { createRun: ReturnType<typeof vi.fn> };

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
      projectReviewService as never,
      productSpecService as never,
      featureWorkstreamService as never,
      userFlowService as never,
      taskPlanningService as never,
      sandboxService as never,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    const recordScopeReviewResult = vi.fn().mockResolvedValue(undefined);
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
      getMilestoneMapMutationState: vi.fn().mockResolvedValue({ replacementLocked: false }),
      getActiveMilestone: vi.fn().mockResolvedValue(null),
      invalidateDeliveryReview: vi.fn().mockResolvedValue(undefined),
      invalidateMapReview: vi.fn().mockResolvedValue(undefined),
      invalidateScopeReview: vi.fn().mockResolvedValue(undefined),
      recordMapReviewResult: vi.fn().mockResolvedValue(undefined),
      recordDeliveryReviewResult: vi.fn().mockResolvedValue(undefined),
      recordScopeReviewResult,
      recordReconciliationResult: recordScopeReviewResult,
      incrementAutoCatchUpCount: vi.fn().mockResolvedValue(undefined),
      transition: vi.fn().mockResolvedValue(undefined),
    };
    onePagerService = { approveCanonical: vi.fn().mockResolvedValue(undefined) };
    projectReviewService = {
      finalizeMilestonePlan: vi.fn().mockResolvedValue({}),
      startReview: vi.fn().mockResolvedValue({ session: null }),
    };
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
    sandboxService = {
      createRun: vi.fn().mockResolvedValue({ id: "sandbox-run-1" }),
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

    it("reconciles a stale running session with no active jobs", async () => {
      const staleSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const db = makeDb({ session: staleSession, activeJobs: [] });
      const updates: Array<{ status?: string; pausedReason?: string; pendingJobCount?: number }> =
        [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(
          (data: { status?: string; pausedReason?: string; pendingJobCount?: number }) => {
            updates.push(data);
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  makeSessionRow({
                    status: "paused" as const,
                    pausedReason: "job_failed",
                    pendingJobCount: 0,
                    activeBatchToken: null,
                  }),
                ]),
              }),
            };
          },
        ),
      });
      const service = makeService(db);

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session?.status).toBe("paused");
      expect(result.session?.pausedReason).toBe("job_failed");
      expect(updates[0]?.pendingJobCount).toBe(0);
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("does not pause a recently updated running session while its next job is still being enqueued", async () => {
      const freshSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        updatedAt: new Date(),
      });
      const db = makeDb({ session: freshSession, activeJobs: [] });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([freshSession]),
            }),
          };
        }),
      });
      const service = makeService(db);

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session?.status).toBe("running");
      expect(result.session?.pausedReason).toBeNull();
      expect(updates).toEqual([]);
      expect(sseHub.publish).not.toHaveBeenCalled();
    });

    it("recovers a settled successful batch instead of pausing the session", async () => {
      const staleSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const settledJob = {
        ...makeJob(),
        type: "ReviewMilestoneCoverage",
        status: "succeeded" as const,
      };
      const db = makeDb({ session: staleSession, activeJobs: [] });
      let sessionReadCount = 0;
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        sessionReadCount += 1;
        if (sessionReadCount === 1) {
          return staleSession;
        }
        return makeSessionRow({
          status: "running" as const,
          currentStep: "overview",
          pendingJobCount: 1,
          activeBatchToken: "new-batch",
        });
      });
      let jobsReadCount = 0;
      db.query.jobsTable.findMany = vi.fn().mockImplementation(async () => {
        jobsReadCount += 1;
        return jobsReadCount === 1 ? [] : [settledJob];
      });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: "running" as const,
                  currentStep: "overview",
                  pendingJobCount: 1,
                  activeBatchToken: "new-batch",
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      const result = await service.getStatus(USER_ID, PROJECT_ID);

      expect(result.session?.status).toBe("running");
      expect(result.session?.currentStep).toBe("overview");
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateProjectOverview",
          projectId: PROJECT_ID,
        }),
      );
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pendingJobCount: 0,
            activeBatchToken: null,
          }),
          expect.objectContaining({
            currentStep: "overview",
            pendingJobCount: 1,
          }),
        ]),
      );
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

    it("restarts a stale running session after reconciling it", async () => {
      const staleSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const updatedSession = makeSessionRow({
        status: "paused" as const,
        pausedReason: "job_failed",
        pendingJobCount: 0,
        activeBatchToken: null,
      });
      const db = makeDb({ session: staleSession, activeJobs: [] });
      let sessionReadCount = 0;
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        sessionReadCount += 1;
        if (sessionReadCount === 1) {
          return staleSession;
        }
        if (sessionReadCount === 2) {
          return updatedSession;
        }
        return makeSessionRow({ status: "running" as const });
      });
      const updateResults = [
        [updatedSession],
        [makeSessionRow({ status: "running" as const, startedAt: NOW })],
        [makeSessionRow({ status: "running" as const, currentStep: "overview" })],
      ];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(async () => updateResults.shift() ?? [makeSessionRow()]),
          }),
        })),
      });
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateProjectOverview",
          projectId: PROJECT_ID,
        }),
      );
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

    it("queues a sandbox implementation run when the next action is feature_implement", async () => {
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "feature_implement",
            label: "Implement feature: Feature",
            href: `/projects/${PROJECT_ID}/develop?featureId=feature-1`,
          },
        ],
      });
      const db = makeDb({ session: null });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([makeSessionRow()]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.start(USER_ID, PROJECT_ID, {});

      expect(sandboxService.createRun).toHaveBeenCalledWith(
        USER_ID,
        PROJECT_ID,
        { featureId: "feature-1", kind: "implement" },
        null,
        expect.objectContaining({
          _autoAdvance: expect.objectContaining({
            sessionId: SESSION_ID,
            batchToken: expect.any(String),
          }),
        }),
      );
      expect(jobService.createJob).not.toHaveBeenCalled();
      expect(
        updates.some(
          (update) =>
            update.currentStep === "feature_implement" &&
            update.pendingJobCount === 1,
        ),
      ).toBe(true);
    });

    it("auto-approves the overview when skipReviewSteps is enabled", async () => {
      let buildCallCount = 0;
      nextActionsService.buildBatch.mockImplementation(async () => {
        buildCallCount++;
        if (buildCallCount === 1) {
          return {
            actions: [
              {
                key: "overview_approval",
                label: "Approve the overview document",
                href: `/projects/${PROJECT_ID}/one-pager`,
              },
            ],
          };
        }
        return { actions: [] };
      });
      onePagerService.approveCanonical.mockResolvedValue(undefined);

      const session = makeSessionRow({
        status: "paused" as const,
        pausedReason: "manual_pause",
        skipReviewSteps: true,
      });
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi
        .fn()
        .mockResolvedValue(makeSessionRow({ status: "running" as const, skipReviewSteps: true }));
      db.query.autoAdvanceSessionsTable.findFirst.mockResolvedValueOnce(session);
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(onePagerService.approveCanonical).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ReviewDelivery", projectId: PROJECT_ID }),
      );
    });

    it("auto-approves feature product specs when skipReviewSteps is enabled", async () => {
      const featureId = "feature-123";
      let buildCallCount = 0;
      nextActionsService.buildBatch.mockImplementation(async () => {
        buildCallCount++;
        if (buildCallCount === 1) {
          return {
            actions: [
              {
                key: "feature_product_approval",
                label: "Approve a feature Product Spec",
                href: `/projects/${PROJECT_ID}/features/${featureId}/product`,
              },
            ],
          };
        }
        return { actions: [] };
      });
      featureWorkstreamService.getTracks.mockResolvedValue({
        tracks: {
          product: {
            status: "draft",
            headRevision: { id: "rev-123" },
          },
        },
      } as never);
      featureWorkstreamService.approveRevision.mockResolvedValue(undefined);

      const session = makeSessionRow({
        status: "paused" as const,
        pausedReason: "manual_pause",
        skipReviewSteps: true,
      });
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi
        .fn()
        .mockResolvedValue(makeSessionRow({ status: "running" as const, skipReviewSteps: true }));
      db.query.autoAdvanceSessionsTable.findFirst.mockResolvedValueOnce(session);
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(featureWorkstreamService.getTracks).toHaveBeenCalledWith(USER_ID, featureId);
      expect(featureWorkstreamService.approveRevision).toHaveBeenCalledWith(
        USER_ID,
        featureId,
        "product",
        "rev-123",
      );
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ReviewDelivery", projectId: PROJECT_ID }),
      );
    });

    it("auto-completes the milestone when skipReviewSteps is enabled", async () => {
      let buildCallCount = 0;
      nextActionsService.buildBatch.mockImplementation(async () => {
        buildCallCount++;
        if (buildCallCount === 1) {
          return {
            actions: [
              {
                key: "milestone_complete",
                label: "Complete the active milestone",
                href: `/projects/${PROJECT_ID}/milestones`,
              },
            ],
          };
        }
        return { actions: [] };
      });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "milestone-123",
        status: "approved",
      } as never);
      milestoneService.transition.mockResolvedValue(undefined);

      const session = makeSessionRow({
        status: "paused" as const,
        pausedReason: "manual_pause",
        skipReviewSteps: true,
      });
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi
        .fn()
        .mockResolvedValue(makeSessionRow({ status: "running" as const, skipReviewSteps: true }));
      db.query.autoAdvanceSessionsTable.findFirst.mockResolvedValueOnce(session);
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(milestoneService.transition).toHaveBeenCalledWith(
        USER_ID,
        "milestone-123",
        { action: "complete" },
      );
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ReviewDelivery", projectId: PROJECT_ID }),
      );
    });

    it("auto-finalizes milestone planning and starts the project review", async () => {
      let buildCallCount = 0;
      nextActionsService.buildBatch.mockImplementation(async () => {
        buildCallCount++;
        if (buildCallCount === 1) {
          return {
            actions: [
              {
                key: "milestone_plan_finalize",
                label: "Finalize milestone planning",
                href: `/projects/${PROJECT_ID}/develop/review`,
              },
            ],
          };
        }

        return {
          actions: [
            {
              key: "project_review_run",
              label: "Run project review",
              href: `/projects/${PROJECT_ID}/develop/review`,
            },
          ],
        };
      });

      const session = makeSessionRow({
        status: "paused" as const,
        pausedReason: "manual_pause",
      });
      const db = makeDb({ session });
      db.query.autoAdvanceSessionsTable.findFirst = vi
        .fn()
        .mockResolvedValue(makeSessionRow({ status: "running" as const }));
      db.query.autoAdvanceSessionsTable.findFirst.mockResolvedValueOnce(session);
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(projectReviewService.finalizeMilestonePlan).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
      expect(projectReviewService.startReview).toHaveBeenCalledWith(
        USER_ID,
        PROJECT_ID,
        "auto_advance",
        undefined,
        expect.objectContaining({
          sessionId: session.id,
        }),
      );
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

  describe("recoverRunningSessions", () => {
    it("reconciles running sessions during startup recovery", async () => {
      const staleSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const db = makeDb({ session: staleSession });
      db.query.autoAdvanceSessionsTable.findMany = vi.fn().mockResolvedValue([staleSession]);
      db.query.jobsTable.findMany = vi.fn().mockResolvedValue([]);
      const service = makeService(db);

      await service.recoverRunningSessions();

      expect(db.query.autoAdvanceSessionsTable.findMany).toHaveBeenCalled();
      expect(sseHub.publish).toHaveBeenCalled();
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
        error: {
          message: "OpenAI-compatible generation request failed: timed out after 30000ms",
          hint: "retry with the same scope after timeout",
          retryable: true,
        },
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
      expect(retryUpdate?.activeBatchToken).toBe("batch-1");
      expect(updates.find((u) => u.status === "paused")).toBeUndefined();
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureTechSpec",
          projectId: PROJECT_ID,
          inputs: expect.objectContaining({
            featureId: "feature-123",
            hint: "retry with the same scope after timeout",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
              batchToken: "batch-1",
            }),
          }),
        }),
      );
      expect(sseHub.publish).toHaveBeenCalled();
    });

    it("retries ImplementChange with a fresh sandbox run even when the failure is not marked retryable", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "ImplementChange",
        error: {
          message: "implement run exited with code 1.",
        },
        inputs: {
          featureId: "feature-123",
          sandboxRunId: "sandbox-run-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: failedJob });
      const updates: Array<{ retryCount?: number; pendingJobCount?: number; status?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(
          (data: { retryCount?: number; pendingJobCount?: number; status?: string }) => {
            updates.push(data);
            return {
              where: vi
                .fn()
                .mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const })]) }),
            };
          },
        ),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      expect(jobService.createJob).not.toHaveBeenCalled();
      expect(sandboxService.createRun).toHaveBeenCalledWith(
        USER_ID,
        PROJECT_ID,
        { featureId: "feature-123", kind: "implement" },
        null,
        expect.objectContaining({
          featureId: "feature-123",
          _autoAdvance: expect.objectContaining({
            sessionId: SESSION_ID,
            batchToken: "batch-1",
            retryAttempt: 1,
          }),
        }),
      );
      expect(
        updates.some((update) => update.retryCount === 1 && update.pendingJobCount === 1),
      ).toBe(true);
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("retries RunProjectReview even when the sandbox failure is not marked retryable", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "RunProjectReview",
        error: {
          message: "project_review run exited with code 1.",
        },
        inputs: {
          attemptId: "attempt-123",
          sessionId: "review-session-123",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: failedJob });
      const updates: Array<{ retryCount?: number; pendingJobCount?: number; status?: string }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(
          (data: { retryCount?: number; pendingJobCount?: number; status?: string }) => {
            updates.push(data);
            return {
              where: vi
                .fn()
                .mockReturnValue({ returning: vi.fn().mockResolvedValue([makeSessionRow({ status: "running" as const })]) }),
            };
          },
        ),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "failure");

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RunProjectReview",
          projectId: PROJECT_ID,
          inputs: expect.objectContaining({
            attemptId: "attempt-123",
            sessionId: "review-session-123",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
              batchToken: "batch-1",
              retryAttempt: 1,
            }),
          }),
        }),
      );
      expect(
        updates.some((update) => update.retryCount === 1 && update.pendingJobCount === 1),
      ).toBe(true);
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("pauses session with job_failed on the third consecutive failure", async () => {
      const failedJob = {
        ...makeJob(),
        error: {
          message: "OpenAI-compatible generation request failed: timed out after 30000ms",
          retryable: true,
        },
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

    it("pauses milestone design retries with needs_human after the retry budget is exhausted", async () => {
      const failedJob = {
        ...makeJob(),
        type: "GenerateMilestoneDesign",
        error: {
          message:
            "GenerateMilestoneDesign returned an invalid ownedScreens array for deliveryGroup account-shell.",
          code: "llm_output_invalid",
          retryable: true,
        },
        inputs: {
          milestoneId: "milestone-123",
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
      expect(pauseUpdate?.pausedReason).toBe("needs_human");
      expect(jobService.createJob).not.toHaveBeenCalled();
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
        error: {
          message: "OpenAI-compatible generation request failed: timed out after 30000ms",
          hint: "retry with the same scope after timeout",
          retryable: true,
        },
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

    it("retries blueprint generation when exhausted decision repair is marked retryable", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "GenerateProjectBlueprint",
        error: {
          message:
            "ValidateDecisionConsistency found conflicts: Selected decision contradicts the approved Product Spec.",
          code: "decision_conflict_unresolved",
          retryable: true,
        },
        inputs: {
          kind: "ux",
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
          type: "GenerateProjectBlueprint",
          inputs: expect.objectContaining({
            kind: "ux",
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

    it("ignores duplicate success callbacks after the batch has been claimed", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
      });
      const clearedSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 0,
        activeBatchToken: null,
      });
      const db = makeDb({ session: runningSession, job: makeJob() });
      let sessionLookupCount = 0;
      db.query.autoAdvanceSessionsTable.findFirst = vi.fn().mockImplementation(async () => {
        sessionLookupCount += 1;
        if (sessionLookupCount <= 2) {
          return runningSession;
        }

        return clearedSession;
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");
      await service.onJobComplete(JOB_ID, "success");

      expect(jobService.createJob).toHaveBeenCalledTimes(1);
    });

    it("pauses immediately on a non-retryable failure", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "GenerateProjectBlueprint",
        error: {
          message: "ValidateDecisionConsistency found conflicts: Selected decision contradicts the approved Product Spec.",
          code: "decision_conflict_unresolved",
          retryable: false,
        },
        inputs: {
          kind: "ux",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
      };
      const db = makeDb({ session: runningSession, job: failedJob });
      const updates: Array<{ status?: string; pausedReason?: string; retryCount?: number }> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(
          (data: { status?: string; pausedReason?: string; retryCount?: number }) => {
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

      expect(jobService.createJob).not.toHaveBeenCalled();
      const pauseUpdate = updates.find((update) => update.status === "paused");
      expect(pauseUpdate?.pausedReason).toBe("job_failed");
    });

    it("pauses with needs_human when delivery review finds only human-review issues", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneDelivery",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          milestoneId: "milestone-1",
          issues: [{ action: "needs_human_review", hint: "Clarify artifact ownership." }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: data.status === "paused" ? ("paused" as const) : ("running" as const),
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
      expect(milestoneService.recordDeliveryReviewResult).toHaveBeenCalledWith(
        expect.objectContaining({
          milestoneId: "milestone-1",
          status: "failed_needs_human",
        }),
      );
      expect(
        updates.some(
          (update) => update.status === "paused" && update.pausedReason === "needs_human",
        ),
      ).toBe(true);
    });

    it("skips delivery-review human gates when skipHumanReview is enabled", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        skipHumanReview: true,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneDelivery",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          milestoneId: "milestone-1",
          issues: [{ action: "needs_human_review", hint: "Clarify artifact ownership." }],
        } as never,
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
      const db = makeDb({ session: runningSession, job: reviewJob });
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
                  activeBatchToken: updateCall >= 3 ? "batch-2" : null,
                }),
              ]),
            }),
          };
        }),
      });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "milestone-1",
        status: "approved",
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.invalidateDeliveryReview).toHaveBeenCalledWith("milestone-1");
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureProductSpec",
          inputs: expect.objectContaining({
            featureId: "feature-123",
          }),
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("skips milestone-map human gates when skipHumanReview is enabled", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        skipHumanReview: true,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneMap",
        inputs: {
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues: [{ action: "needs_human_review", hint: "Clarify milestone sequencing." }],
        } as never,
      };
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "milestones_generate",
            label: "Generate milestones",
            href: `/projects/${PROJECT_ID}/milestones`,
          },
        ],
      });
      const db = makeDb({ session: runningSession, job: reviewJob });
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
                  activeBatchToken: updateCall >= 3 ? "batch-2" : null,
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.recordMapReviewResult).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          status: "failed_needs_human",
        }),
      );
      expect(milestoneService.invalidateMapReview).toHaveBeenCalledWith(PROJECT_ID);
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateMilestones",
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
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

    it("enqueues append-only milestone repair when ReviewDelivery reports append work", async () => {
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
          issues: [{ jobType: "AppendMilestones", hint: "Add follow-up milestone coverage" }],
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
          type: "AppendMilestones",
          inputs: expect.objectContaining({ hint: "Add follow-up milestone coverage" }),
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
        autoRepairMilestoneCoverage: true,
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
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RewriteMilestoneFeatureSet",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            attemptNumber: 1,
            issues: [{ action: "rewrite_feature_set", hint: "Missing milestone docs." }],
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("uses the job input milestone id instead of the job output milestone id", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
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
          milestoneId: "milestone-from-other-project",
          issues: [{ action: "rewrite_feature_set", hint: "Missing milestone docs." }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
          projectId: PROJECT_ID,
        }),
      } as never;
      let updateCall = 0;
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation(() => {
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
        }),
      );
      expect(milestoneService.recordReconciliationResult).not.toHaveBeenCalledWith(
        expect.objectContaining({
          milestoneId: "milestone-from-other-project",
        }),
      );
    });

    it("queues a scope-review rewrite when structural issues remain", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneScope",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues: [{ action: "rewrite_feature_set", hint: "Align feature boundaries." }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
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
                  milestoneRepairCount: 1,
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
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RewriteMilestoneFeatureSet",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            attemptNumber: 1,
            issues: [{ action: "rewrite_feature_set", hint: "Align feature boundaries." }],
          }),
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("pauses immediately when scope review returns only needs_human_review issues", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
        milestoneRepairCount: 0,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneScope",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues: [{ action: "needs_human_review", hint: "Clarify source-of-truth ownership." }],
        } as never,
      };
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
        }),
      } as never;
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
                  pendingJobCount: 0,
                  activeBatchToken: null,
                  milestoneRepairCount: 0,
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
      expect(
        updates.some(
          (update) => update.status === "paused" && update.pausedReason === "needs_human",
        ),
      ).toBe(true);
      expect(
        updates.some((update) => typeof update.milestoneRepairCount === "number"),
      ).toBe(false);
    });

    it("skips scope-review human gates when skipHumanReview is enabled", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        skipHumanReview: true,
      });
      const reviewJob = {
        ...makeJob(),
        type: "ReviewMilestoneScope",
        inputs: {
          milestoneId: "milestone-1",
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          complete: false,
          issues: [{ action: "needs_human_review", hint: "Clarify source-of-truth ownership." }],
        } as never,
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
      const db = makeDb({ session: runningSession, job: reviewJob });
      db.query.milestonesTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: "milestone-1",
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
                  activeBatchToken: updateCall >= 3 ? "batch-2" : null,
                }),
              ]),
            }),
          };
        }),
      });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "milestone-1",
        status: "approved",
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.invalidateScopeReview).toHaveBeenCalledWith("milestone-1");
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureProductSpec",
          inputs: expect.objectContaining({
            featureId: "feature-123",
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
        autoRepairMilestoneCoverage: true,
        milestoneRepairCount: 3,
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
      expect(pauseUpdate?.pausedReason).toBe("milestone_repair_limit_reached");
    });

    it("queues a milestone repair when enabled for ambiguous reconciliation issues", async () => {
      const issues = [
        { action: "needs_human_review", hint: "Clarify governance evidence." },
        { action: "needs_human_review", hint: "Clarify legal copy scope." },
      ];
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
        milestoneRepairCount: 0,
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
                  autoRepairMilestoneCoverage: true,
                  milestoneRepairCount: 1,
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
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ResolveMilestoneCoverageIssues",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            issues,
            attemptNumber: 1,
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
      expect(
        updates.some(
          (update) =>
            update.currentStep === "milestone_reconciliation_resolve" &&
            update.pendingJobCount === 1,
        ),
      ).toBe(true);
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("queues a stored milestone repair when resuming into milestone_reconciliation_resolve", async () => {
      const pausedSession = makeSessionRow({
        status: "paused" as const,
        pausedReason: "needs_human",
        autoRepairMilestoneCoverage: true,
      });
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "milestone_reconciliation_resolve",
            label: "Resolve milestone coverage gaps",
            href: `/projects/${PROJECT_ID}/milestones`,
          },
        ],
      });
      const db = makeDb({ session: pausedSession, job: makeJob() });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "milestone-1",
        projectId: PROJECT_ID,
        status: "approved",
        reconciliationStatus: "failed_needs_human",
        reconciliationIssues: [
          { action: "needs_human_review", hint: "Clarify timer ownership." },
        ],
        reconciliationReviewedAt: NOW,
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ResolveMilestoneCoverageIssues",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            issues: [{ action: "needs_human_review", hint: "Clarify timer ownership." }],
            attemptNumber: 1,
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
    });

    it("pauses on milestone_reconciliation_resolve when the milestone repair limit is already reached", async () => {
      const pausedSession = makeSessionRow({
        status: "paused" as const,
        pausedReason: "milestone_repair_limit_reached",
        autoRepairMilestoneCoverage: true,
        milestoneRepairCount: 3,
      });
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "milestone_reconciliation_resolve",
            label: "Resolve milestone coverage gaps",
            href: `/projects/${PROJECT_ID}/milestones`,
          },
        ],
      });
      const db = makeDb({ session: pausedSession, job: makeJob() });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "milestone-1",
        projectId: PROJECT_ID,
        status: "approved",
        reconciliationStatus: "failed_needs_human",
        reconciliationIssues: [
          { action: "needs_human_review", hint: "Clarify timer ownership." },
        ],
        reconciliationReviewedAt: NOW,
      });
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: data.status === "paused" ? ("paused" as const) : ("running" as const),
                  pausedReason:
                    data.status === "paused"
                      ? ("milestone_repair_limit_reached" as const)
                      : null,
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await service.resume(USER_ID, PROJECT_ID);

      expect(jobService.createJob).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "ResolveMilestoneCoverageIssues" }),
      );
      expect(
        updates.some(
          (update) =>
            update.status === "paused" &&
            update.pausedReason === "milestone_repair_limit_reached",
        ),
      ).toBe(true);
    });

    it("fails closed when stored milestone repair lookup throws during resume", async () => {
      const pausedSession = makeSessionRow({
        status: "paused" as const,
        pausedReason: "job_failed",
        autoRepairMilestoneCoverage: true,
      });
      nextActionsService.build.mockResolvedValue({
        actions: [
          {
            key: "milestone_reconciliation_resolve",
            label: "Resolve milestone coverage gaps",
            href: `/projects/${PROJECT_ID}/milestones`,
          },
        ],
      });
      const db = makeDb({ session: pausedSession, job: makeJob() });
      milestoneService.getActiveMilestone.mockRejectedValue(new Error("lookup failed"));
      const updates: Array<Record<string, unknown>> = [];
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updates.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                makeSessionRow({
                  status: data.status === "paused" ? ("paused" as const) : ("running" as const),
                  pausedReason:
                    data.status === "paused" ? ("job_failed" as const) : null,
                }),
              ]),
            }),
          };
        }),
      });
      const service = makeService(db);

      await expect(service.resume(USER_ID, PROJECT_ID)).rejects.toThrow("lookup failed");

      expect(
        updates.some(
          (update) =>
            update.status === "paused" &&
            update.pausedReason === "job_failed" &&
            update.pendingJobCount === 0,
        ),
      ).toBe(true);
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

    it("retries an unresolved milestone repair while attempts remain", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
        milestoneRepairCount: 1,
      });
      const repairJob = {
        ...makeJob(),
        type: "ResolveMilestoneCoverageIssues",
        inputs: {
          milestoneId: "milestone-1",
          issues: [{ action: "needs_human_review", hint: "Clarify scope." }],
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
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
                  status: "running" as const,
                  milestoneRepairCount:
                    typeof data.milestoneRepairCount === "number" ? data.milestoneRepairCount : 2,
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
          type: "ResolveMilestoneCoverageIssues",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            attemptNumber: 2,
            previousUnresolvedReasons: ["Still requires a manual scope decision."],
          }),
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
    });

    it("pauses when an unresolved milestone repair hits the repair limit", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        autoRepairMilestoneCoverage: true,
        milestoneRepairCount: 3,
      });
      const repairJob = {
        ...makeJob(),
        type: "ResolveMilestoneCoverageIssues",
        inputs: {
          milestoneId: "milestone-1",
          issues: [{ action: "needs_human_review", hint: "Clarify scope." }],
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
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
      expect(
        updates.some(
          (update) =>
            update.status === "paused" &&
            update.pausedReason === "needs_human",
        ),
      ).toBe(true);
    });

    it("skips unresolved milestone repair human gates when skipHumanReview is enabled", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        skipHumanReview: true,
        milestoneRepairCount: 3,
      });
      const repairJob = {
        ...makeJob(),
        type: "ResolveMilestoneCoverageIssues",
        inputs: {
          milestoneId: "milestone-1",
          issues: [{ action: "needs_human_review", hint: "Clarify scope." }],
          _autoAdvance: {
            sessionId: SESSION_ID,
            batchToken: "batch-1",
          },
        },
        outputs: {
          resolved: false,
          unresolvedReasons: ["Still requires a manual scope decision."],
        } as never,
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
      const db = makeDb({ session: runningSession, job: repairJob });
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
                  activeBatchToken: updateCall >= 3 ? "batch-2" : null,
                }),
              ]),
            }),
          };
        }),
      });
      milestoneService.getActiveMilestone.mockResolvedValue({
        id: "milestone-1",
        status: "approved",
      });
      const service = makeService(db);

      await service.onJobComplete(JOB_ID, "success");

      expect(milestoneService.invalidateScopeReview).toHaveBeenCalledWith("milestone-1");
      expect(jobService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GenerateFeatureProductSpec",
          inputs: expect.objectContaining({
            featureId: "feature-123",
          }),
        }),
      );
      expect(updates.some((update) => update.status === "paused")).toBe(false);
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

    it("starts a CI repair attempt when milestone CI is stale-pending", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 1,
        activeBatchToken: "batch-1",
        ciFixCount: 1,
      });
      const ciGateJob = {
        ...makeJob(),
        type: "WaitForMilestoneCi",
        outputs: {
          state: "stale_pending",
          milestoneId: "milestone-1",
        } as never,
      };
      const db = makeDb({ session: runningSession, job: ciGateJob });
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
                  pendingJobCount:
                    updateCall === 1
                      ? 0
                      : typeof data.pendingJobCount === "number"
                        ? data.pendingJobCount
                        : 1,
                  activeBatchToken:
                    typeof data.activeBatchToken === "string" ? data.activeBatchToken : "batch-2",
                  ciFixCount:
                    typeof data.ciFixCount === "number" ? data.ciFixCount : 2,
                  ciWaitWindowCount:
                    typeof data.ciWaitWindowCount === "number" ? data.ciWaitWindowCount : 0,
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
          type: "RepairMilestoneCi",
          inputs: expect.objectContaining({
            milestoneId: "milestone-1",
            diagnosis: "pending_checks_stale",
            _autoAdvance: expect.objectContaining({
              sessionId: SESSION_ID,
            }),
          }),
        }),
      );
      expect(
        updates.some(
          (update) =>
            update.ciFixCount === 2 &&
            update.ciWaitWindowCount === 0 &&
            update.pendingJobCount === 1,
        ),
      ).toBe(true);
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

    it("waits for the rest of a parallel batch before retrying a failed job", async () => {
      const runningSession = makeSessionRow({
        status: "running" as const,
        pendingJobCount: 3,
        retryCount: 0,
        activeBatchToken: "batch-1",
      });
      const failedJob = {
        ...makeJob(),
        type: "GenerateFeatureTechSpec",
        error: {
          message: "OpenAI-compatible generation request failed: timed out after 30000ms",
          retryable: true,
        },
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
      expect(updates.find((u) => u.retryCount === 1)).toBeUndefined();
      expect(jobService.createJob).not.toHaveBeenCalled();
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
