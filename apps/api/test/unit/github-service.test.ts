import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGithubService } from "../../src/services/github-service.js";

describe("github service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("looks up an open pull request by head branch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{ number: 12, html_url: "https://github.com/acme/repo/pull/12" }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const service = createGithubService();

    const pr = await service.findOpenPullRequestForHead({
      owner: "acme",
      repo: "repo",
      token: "github_pat_secret",
      head: "quayboard/m-001/abcd1234",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("head=acme%3Aquayboard%2Fm-001%2Fabcd1234"),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer github_pat_secret",
        }),
      }),
    );
    expect(pr).toEqual({
      number: 12,
      url: "https://github.com/acme/repo/pull/12",
    });
  });

  it("merges a pull request with the requested merge strategy", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ merged: true, sha: "abc123" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const service = createGithubService();

    const result = await service.mergePullRequest({
      owner: "acme",
      repo: "repo",
      token: "github_pat_secret",
      pullNumber: 7,
      method: "merge",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/repo/pulls/7/merge",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ merge_method: "merge" }),
      }),
    );
    expect(result).toEqual({ merged: true, sha: "abc123" });
  });

  it("treats missing remote branches as already deleted", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const service = createGithubService();

    const result = await service.deleteBranch({
      owner: "acme",
      repo: "repo",
      token: "github_pat_secret",
      branch: "quayboard/m-001/abcd1234",
    });

    expect(result).toEqual({ deleted: false, notFound: true });
  });

  it("aggregates check runs and commit statuses into a CI summary", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            check_runs: [
              {
                id: 10,
                name: "build",
                status: "completed",
                conclusion: "success",
                started_at: "2026-01-01T00:00:00Z",
                completed_at: "2026-01-01T00:05:00Z",
                updated_at: "2026-01-01T00:05:00Z",
                workflow_name: "CI",
              },
              {
                id: 11,
                name: "test",
                status: "completed",
                conclusion: "failure",
                started_at: "2026-01-01T00:00:00Z",
                completed_at: "2026-01-01T00:05:00Z",
                updated_at: "2026-01-01T00:05:00Z",
                workflow_name: "CI",
                output: { summary: "Unit tests failed" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statuses: [
              {
                id: 21,
                context: "deploy",
                state: "pending",
                target_url: "https://ci.example/deploy",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:03:00Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const service = createGithubService();

    const result = await service.getCommitCiStatus({
      owner: "acme",
      repo: "repo",
      token: "github_pat_secret",
      ref: "feature-branch",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      ref: "feature-branch",
      total: 3,
      pending: 1,
      passing: 1,
      failing: 1,
      state: "failing",
      isStale: false,
      checks: [
        {
          id: "10",
          name: "build",
          source: "check_run",
          status: "completed",
          conclusion: "success",
          detailsUrl: null,
          workflowName: "CI",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:05:00.000Z",
          lastUpdatedAt: "2026-01-01T00:05:00.000Z",
        },
        {
          id: "11",
          name: "test",
          source: "check_run",
          status: "completed",
          conclusion: "failure",
          detailsUrl: null,
          workflowName: "CI",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:05:00.000Z",
          lastUpdatedAt: "2026-01-01T00:05:00.000Z",
        },
        {
          id: "21",
          name: "deploy",
          source: "commit_status",
          status: "pending",
          conclusion: null,
          detailsUrl: "https://ci.example/deploy",
          workflowName: null,
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: null,
          lastUpdatedAt: "2026-01-01T00:03:00.000Z",
        },
      ],
      failures: [
        {
          id: "11",
          name: "test",
          source: "check_run",
          summary: "Unit tests failed",
          detailsUrl: null,
        },
      ],
    });
  });

  it("marks pending CI as stale when pending checks have not updated for the threshold", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:30:00.000Z"));

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              check_runs: [
                {
                  id: 31,
                  name: "build (20.x)",
                  status: "in_progress",
                  conclusion: null,
                  started_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-01T00:05:00Z",
                  details_url: "https://ci.example/build-20",
                  workflow_name: "CI",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ statuses: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      const service = createGithubService();

      const result = await service.getCommitCiStatus({
        owner: "acme",
        repo: "repo",
        token: "github_pat_secret",
        ref: "feature-branch",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.state).toBe("pending");
      expect(result.isStale).toBe(true);
      expect(result.checks).toEqual([
        {
          id: "31",
          name: "build (20.x)",
          source: "check_run",
          status: "in_progress",
          conclusion: null,
          detailsUrl: "https://ci.example/build-20",
          workflowName: "CI",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: null,
          lastUpdatedAt: "2026-01-01T00:05:00.000Z",
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
