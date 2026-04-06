import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../src/app.js";
import { ProjectReviewPage } from "../src/pages/ProjectReviewPage.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";

class MockEventSource {
  addEventListener() {}

  removeEventListener() {}

  close() {}
}

const installFetchStub = (responses: Record<string, unknown>) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === "string" ? input : input.toString();
      const body = responses[path];

      if (body === undefined) {
        throw new Error(`Unhandled fetch for ${path}`);
      }

      return {
        ok: true,
        status: 200,
        json: async () => body,
      } satisfies Partial<Response>;
    }),
  );
};

const renderPage = () => {
  const router = createMemoryRouter(
    [
      { path: "/", element: <div /> },
      { path: "/docs", element: <div /> },
      { path: "/settings", element: <div /> },
      { path: "/projects/:id", element: <div /> },
      { path: "/projects/:id/settings", element: <div /> },
      { path: "/projects/:id/milestones", element: <div /> },
      { path: "/projects/:id/develop", element: <div /> },
      { path: "/projects/:id/develop/debug", element: <div /> },
      { path: "/projects/:id/develop/review", element: <ProjectReviewPage /> },
    ],
    {
      initialEntries: [`/projects/${projectId}/develop/review`],
    },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProjectReviewPage", () => {
  it("renders the latest review as markdown and orders session findings by state", async () => {
    vi.stubGlobal("EventSource", MockEventSource);

    const reviewSession = {
      session: {
        id: "review-session-1",
        projectId,
        status: "running_fix",
        loopCount: 3,
        maxLoops: 5,
        autoApplyFixes: true,
        branchName: "quayboard/project-review-fixes",
        pullRequestUrl: "https://github.com/acme/repo/pull/1",
        createdAt: "2026-04-06T12:00:00.000Z",
        startedAt: "2026-04-06T12:00:00.000Z",
        completedAt: null,
        attempts: [
          {
            id: "attempt-review-1",
            projectReviewSessionId: "review-session-1",
            projectId,
            kind: "review",
            status: "succeeded",
            sequence: 1,
            sandboxRunId: "sandbox-review-1",
            jobId: "job-review-1",
            reportMarkdown: "# Review\n\n## Overview\n\nRendered report text.",
            summary: {
              executiveSummary: "Summary",
              maturityLevel: "Maturing",
              usabilityVerdict: "Usable",
              biggestStrengths: [],
              biggestRisks: [],
              finalVerdict: {
                documentationGoodEnough: false,
                testsGoodEnough: false,
                projectCompleteEnough: false,
                codeHasMajorIssues: true,
                confidence: "medium",
              },
            },
            findings: [
              {
                id: "finding-open-medium",
                projectReviewAttemptId: "attempt-review-1",
                category: "tests",
                severity: "medium",
                finding: "Medium issue",
                evidence: [{ path: "src/medium.ts" }],
                whyItMatters: "Medium impact",
                recommendedImprovement: "Improve medium issue",
                status: "open",
                createdAt: "2026-04-06T12:00:01.000Z",
                resolvedAt: null,
              },
              {
                id: "finding-open-critical",
                projectReviewAttemptId: "attempt-review-1",
                category: "architecture",
                severity: "critical",
                finding: "Critical issue",
                evidence: [{ path: "src/critical.ts" }],
                whyItMatters: "Critical impact",
                recommendedImprovement: "Fix critical issue",
                status: "open",
                createdAt: "2026-04-06T12:00:00.000Z",
                resolvedAt: null,
              },
              {
                id: "finding-ignored",
                projectReviewAttemptId: "attempt-review-1",
                category: "documentation",
                severity: "low",
                finding: "Ignored issue",
                evidence: [{ path: "README.md" }],
                whyItMatters: "Minor impact",
                recommendedImprovement: "Optional cleanup",
                status: "ignored",
                createdAt: "2026-04-06T11:59:00.000Z",
                resolvedAt: "2026-04-06T12:02:00.000Z",
              },
            ],
            errorMessage: null,
            createdAt: "2026-04-06T12:00:00.000Z",
            completedAt: "2026-04-06T12:01:00.000Z",
          },
          {
            id: "attempt-fix-2",
            projectReviewSessionId: "review-session-1",
            projectId,
            kind: "fix",
            status: "running",
            sequence: 2,
            sandboxRunId: "sandbox-fix-2",
            jobId: "job-fix-2",
            reportMarkdown: null,
            summary: null,
            findings: [],
            errorMessage: null,
            createdAt: "2026-04-06T12:02:00.000Z",
            completedAt: null,
          },
        ],
      },
    };

    installFetchStub({
      "/auth/me": {
        user: {
          id: projectId,
          email: "owner@example.com",
          displayName: "Owner",
          avatarUrl: null,
          createdAt: "2026-04-06T00:00:00.000Z",
          updatedAt: "2026-04-06T00:00:00.000Z",
        },
      },
      [`/api/projects/${projectId}`]: {
        id: projectId,
        name: "Quayboard",
        description: "Governed planning workspace.",
        state: "READY",
        ownerUserId: projectId,
        milestonePlanStatus: "finalized",
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
      [`/api/projects/${projectId}/project-reviews/latest`]: reviewSession,
      [`/api/projects/${projectId}/project-reviews`]: {
        sessions: [reviewSession.session],
      },
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Project Review" })).toBeTruthy();
    expect(
      screen.getByText(/This page is used at the end of development/i),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByText("## Overview")).toBeNull();

    await waitFor(() => {
      expect(screen.getByText("Unaddressed")).toBeTruthy();
      expect(screen.getByText("Closed / non-blocking")).toBeTruthy();
    });

    const criticalIssue = screen.getByText("Critical issue");
    const mediumIssue = screen.getByText("Medium issue");
    const ignoredIssue = screen.getByText("Ignored issue");

    expect(
      criticalIssue.compareDocumentPosition(mediumIssue) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      mediumIssue.compareDocumentPosition(ignoredIssue) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.getByTestId("project-review-layout").className).toContain("items-start");
  });
});
