import { describe, expect, it, vi } from "vitest";

import {
  countOpenProjectReviewFindings,
  createProjectReviewService,
  isProjectReviewHighOnlyPhase,
  partitionProjectReviewFindings,
} from "../../src/services/project-review-service.js";

describe("project review service helpers", () => {
  it("switches to high-only mode only when two or fewer fix passes remain", () => {
    expect(isProjectReviewHighOnlyPhase(0, 5)).toBe(false);
    expect(isProjectReviewHighOnlyPhase(2, 5)).toBe(false);
    expect(isProjectReviewHighOnlyPhase(3, 5)).toBe(true);
    expect(isProjectReviewHighOnlyPhase(4, 5)).toBe(true);
  });

  it("treats only critical and high findings as blocking in the final phase", () => {
    const findings = [
      { severity: "critical" as const, finding: "critical issue" },
      { severity: "high" as const, finding: "high issue" },
      { severity: "medium" as const, finding: "medium issue" },
      { severity: "low" as const, finding: "low issue" },
    ];

    expect(partitionProjectReviewFindings(findings, false)).toEqual({
      blocking: findings,
      ignored: [],
    });

    expect(partitionProjectReviewFindings(findings, true)).toEqual({
      blocking: [
        { severity: "critical", finding: "critical issue" },
        { severity: "high", finding: "high issue" },
      ],
      ignored: [
        { severity: "medium", finding: "medium issue" },
        { severity: "low", finding: "low issue" },
      ],
    });
  });
});

describe("project review service", () => {
  const USER_ID = "00000000-0000-4000-8000-000000000001";
  const PROJECT_ID = "00000000-0000-4000-8000-000000000002";
  const SESSION_ID = "00000000-0000-4000-8000-000000000003";
  const REVIEW_ATTEMPT_ID = "00000000-0000-4000-8000-000000000004";
  const FIX_ATTEMPT_ID = "00000000-0000-4000-8000-000000000005";
  const FINDING_ID = "00000000-0000-4000-8000-000000000006";

  const makeService = () =>
    createProjectReviewService(
      {
        query: {
          projectReviewSessionsTable: { findFirst: vi.fn() },
        },
        update: vi.fn(),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

  it("counts only still-open findings from the latest review session", () => {
    expect(
      countOpenProjectReviewFindings([
        {
          findings: [
            { status: "open" as const },
            { status: "superseded" as const },
          ],
        },
        {
          findings: [
            { status: "ignored" as const },
            { status: "open" as const },
          ],
        },
      ]),
    ).toBe(2);
  });

  it("requeues a review instead of fixes when a failed session never produced review output", async () => {
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const service = createProjectReviewService(
      {
        query: {
          projectReviewSessionsTable: { findFirst: vi.fn() },
        },
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    service.getSessionById = vi.fn().mockResolvedValue({
      session: {
        id: SESSION_ID,
        projectId: PROJECT_ID,
        status: "failed",
        loopCount: 0,
        maxLoops: 5,
        autoApplyFixes: true,
        branchName: null,
        pullRequestUrl: null,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        attempts: [
          {
            id: REVIEW_ATTEMPT_ID,
            projectReviewSessionId: SESSION_ID,
            projectId: PROJECT_ID,
            kind: "review",
            status: "failed",
            sequence: 1,
            sandboxRunId: null,
            jobId: null,
            reportMarkdown: null,
            summary: null,
            findings: [],
            errorMessage: "sandbox crashed",
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
      },
    });
    service.createAttempt = vi.fn().mockResolvedValue(undefined as never);

    await service.retryFixes(USER_ID, SESSION_ID);

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued_review",
      }),
    );
    expect(service.createAttempt).toHaveBeenCalledWith(
      SESSION_ID,
      PROJECT_ID,
      "review",
      USER_ID,
      2,
      undefined,
    );
  });

  it("still requeues fixes when the failed session already has successful review findings", async () => {
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const service = createProjectReviewService(
      {
        query: {
          projectReviewSessionsTable: { findFirst: vi.fn() },
        },
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    service.getSessionById = vi.fn().mockResolvedValue({
      session: {
        id: SESSION_ID,
        projectId: PROJECT_ID,
        status: "failed",
        loopCount: 1,
        maxLoops: 5,
        autoApplyFixes: true,
        branchName: "quayboard/project-review-fixes",
        pullRequestUrl: null,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        attempts: [
          {
            id: REVIEW_ATTEMPT_ID,
            projectReviewSessionId: SESSION_ID,
            projectId: PROJECT_ID,
            kind: "review",
            status: "succeeded",
            sequence: 1,
            sandboxRunId: null,
            jobId: null,
            reportMarkdown: "report",
            summary: null,
            findings: [
              {
                id: FINDING_ID,
                projectReviewAttemptId: REVIEW_ATTEMPT_ID,
                category: "tests",
                severity: "high",
                finding: "Still open",
                evidence: [],
                whyItMatters: "Breaks the release.",
                recommendedImprovement: "Fix it.",
                status: "open",
                createdAt: new Date().toISOString(),
                resolvedAt: null,
              },
            ],
            errorMessage: null,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          {
            id: FIX_ATTEMPT_ID,
            projectReviewSessionId: SESSION_ID,
            projectId: PROJECT_ID,
            kind: "fix",
            status: "failed",
            sequence: 2,
            sandboxRunId: null,
            jobId: null,
            reportMarkdown: null,
            summary: null,
            findings: [],
            errorMessage: "npm install failed",
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
      },
    });
    service.createAttempt = vi.fn().mockResolvedValue(undefined as never);

    await service.retryFixes(USER_ID, SESSION_ID);

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued_fix",
      }),
    );
    expect(service.createAttempt).toHaveBeenCalledWith(
      SESSION_ID,
      PROJECT_ID,
      "fix",
      USER_ID,
      3,
      undefined,
    );
  });

  it("rejects retries when maxLoops does not advance the session", async () => {
    const service = makeService();
    service.getSessionById = vi.fn().mockResolvedValue({
      session: {
        id: SESSION_ID,
        projectId: PROJECT_ID,
        status: "needs_fixes",
        loopCount: 3,
        maxLoops: 5,
        autoApplyFixes: true,
        branchName: null,
        pullRequestUrl: null,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: null,
        attempts: [],
      },
    });

    await expect(service.retryFixes(USER_ID, SESSION_ID, 3)).rejects.toMatchObject({
      code: "project_review_invalid_max_loops",
      statusCode: 409,
    });
  });

  it("preserves the existing pull request url when a clear review run is a no-op", async () => {
    const attemptId = "00000000-0000-4000-8000-000000000007";
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const service = createProjectReviewService(
      {
        query: {
          projectReviewAttemptsTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: attemptId,
              projectReviewSessionId: SESSION_ID,
              projectId: PROJECT_ID,
              sequence: 2,
              jobId: null,
            }),
          },
          projectReviewSessionsTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: SESSION_ID,
              projectId: PROJECT_ID,
              status: "running_review",
              loopCount: 1,
              maxLoops: 5,
              branchName: "quayboard/project-review-fixes",
              pullRequestUrl: "https://github.com/example/repo/pull/8",
            }),
          },
          jobsTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.completeReviewAttempt(
      attemptId,
      "# Review\nAll clear.",
      JSON.stringify({
        executiveSummary: "Looks good.",
        maturityLevel: "solid",
        usabilityVerdict: "good",
        biggestStrengths: [],
        biggestRisks: [],
        finalVerdict: {
          documentationGoodEnough: true,
          testsGoodEnough: true,
          projectCompleteEnough: true,
          codeHasMajorIssues: false,
          confidence: "high",
        },
        engineeringQualityVerdict: "good",
        findings: [],
      }),
      {
        id: "sandbox-run-1",
        branchName: "quayboard/project-review-fixes",
        pullRequestUrl: null,
      },
    );

    expect(result).toEqual({
      clear: true,
      findingCount: 0,
      sessionId: SESSION_ID,
    });
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "clear",
        branchName: "quayboard/project-review-fixes",
        pullRequestUrl: "https://github.com/example/repo/pull/8",
      }),
    );
  });
});
