import { describe, expect, it, vi } from "vitest";

import { createMilestoneService } from "../../src/services/milestone-service.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333";

const makeDb = () => {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const selectLimit = vi.fn().mockResolvedValue([
    {
      id: MILESTONE_ID,
      projectId: PROJECT_ID,
      status: "approved",
      ownerUserId: USER_ID,
    },
  ]);

  return {
    query: {
      milestonesTable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: MILESTONE_ID,
            projectId: PROJECT_ID,
            position: 1,
            status: "approved",
          })
          .mockResolvedValueOnce({
            id: MILESTONE_ID,
            projectId: PROJECT_ID,
            position: 1,
            title: "Milestone 1",
            status: "approved",
            deliveryReviewStatus: "passed",
          }),
      },
      projectsTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: PROJECT_ID,
          ownerUserId: USER_ID,
          userFlowsApprovedAt: new Date(),
          milestoneMapReviewStatus: "passed",
        }),
      },
      reposTable: {
        findFirst: vi.fn().mockResolvedValue({
          projectId: PROJECT_ID,
          owner: "acme",
          name: "repo",
          defaultBranch: "main",
        }),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectLimit,
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: updateSet,
    }),
    updateSet,
  };
};

describe("milestone service", () => {
  it("merges and deletes the milestone branch before marking the milestone completed", async () => {
    const db = makeDb();
    const githubService = {
      branchExists: vi.fn().mockResolvedValue(true),
      deleteBranch: vi.fn().mockResolvedValue({ deleted: true, notFound: false }),
      findOpenPullRequestForHead: vi.fn().mockResolvedValue({
        number: 17,
        url: "https://github.com/acme/repo/pull/17",
      }),
      getCommitCiStatus: vi.fn().mockResolvedValue({
        state: "passing",
        ref: "quayboard/m-001/33333333",
        total: 1,
        pending: 0,
        passing: 1,
        failing: 0,
        failures: [],
      }),
      mergePullRequest: vi.fn().mockResolvedValue({ merged: true, sha: "abc123" }),
    };
    const secretService = {
      buildSecretEnvMap: vi.fn().mockResolvedValue({ GITHUB_PAT: "github_pat_secret" }),
    };
    const service = createMilestoneService(
      db as never,
      githubService as never,
      secretService as never,
    );
    service.list = vi.fn().mockResolvedValue({
      milestones: [{ id: MILESTONE_ID }],
    });

    await service.transition(USER_ID, MILESTONE_ID, { action: "complete" });

    expect(githubService.findOpenPullRequestForHead).toHaveBeenCalledWith(
      expect.objectContaining({ head: "quayboard/m-001/33333333" }),
    );
    expect(githubService.mergePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ pullNumber: 17, method: "merge" }),
    );
    expect(githubService.deleteBranch).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "quayboard/m-001/33333333" }),
    );
    expect(db.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("blocks completion when the milestone pull request cannot be merged", async () => {
    const db = makeDb();
    const githubService = {
      branchExists: vi.fn().mockResolvedValue(true),
      deleteBranch: vi.fn(),
      findOpenPullRequestForHead: vi.fn().mockResolvedValue({
        number: 17,
        url: "https://github.com/acme/repo/pull/17",
      }),
      getCommitCiStatus: vi.fn().mockResolvedValue({
        state: "passing",
        ref: "quayboard/m-001/33333333",
        total: 1,
        pending: 0,
        passing: 1,
        failing: 0,
        failures: [],
      }),
      mergePullRequest: vi.fn().mockRejectedValue(new Error("Pull request is not mergeable.")),
    };
    const secretService = {
      buildSecretEnvMap: vi.fn().mockResolvedValue({ GITHUB_PAT: "github_pat_secret" }),
    };
    const service = createMilestoneService(
      db as never,
      githubService as never,
      secretService as never,
    );
    service.list = vi.fn().mockResolvedValue({
      milestones: [{ id: MILESTONE_ID }],
    });

    await expect(
      service.transition(USER_ID, MILESTONE_ID, { action: "complete" }),
    ).rejects.toThrow("Pull request is not mergeable.");

    expect(githubService.deleteBranch).not.toHaveBeenCalled();
    expect(db.updateSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });
});
