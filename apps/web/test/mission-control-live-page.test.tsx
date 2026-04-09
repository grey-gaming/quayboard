import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Job, User } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { MissionActivityTimeline } from "../src/components/workflow/MissionActivityTimeline.js";
import { MissionControlLivePage } from "../src/pages/MissionControlLivePage.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";
const runningJobId = "d3057770-eca1-417a-a1c6-c00bb83a47d0";
const recentJobId = "11111111-1111-4111-8111-111111111111";

const user: User = {
  id: "00000000-0000-4000-8000-000000000000",
  avatarUrl: null,
  createdAt: "2026-03-15T00:00:00.000Z",
  displayName: "Harbor Admin",
  email: "harbor@example.com",
  updatedAt: "2026-03-15T00:00:00.000Z",
};

class MockEventSource {
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;

  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });

const buildJob = (overrides: Partial<Job>): Job => ({
  id: runningJobId,
  projectId,
  type: "GenerateMilestoneFeatureSet",
  status: "running",
  inputs: {},
  outputs: null,
  error: null,
  queuedAt: "2026-04-09T10:00:00.000Z",
  startedAt: "2026-04-09T10:01:00.000Z",
  completedAt: null,
  ...overrides,
});

const renderLivePage = () => {
  const routes = new Map<string, ReactNode>([
    ["/", <div />],
    ["/docs", <div />],
    ["/settings", <div />],
    ["/projects/:id", <div />],
    ["/projects/:id/settings", <div />],
    ["/projects/:id/questions", <div />],
    ["/projects/:id/one-pager", <div />],
    ["/projects/:id/product-spec", <div />],
    ["/projects/:id/user-flows", <div />],
    ["/projects/:id/ux-spec", <div />],
    ["/projects/:id/technical-spec", <div />],
    ["/projects/:id/milestones", <div />],
    ["/projects/:id/features", <div />],
    ["/projects/:id/live/:jobId", <MissionControlLivePage />],
    ["/projects/:id/live", <MissionControlLivePage />],
  ]);

  const router = createMemoryRouter(
    Array.from(routes.entries()).map(([path, element]) => ({ path, element })),
    { initialEntries: [`/projects/${projectId}/live/${runningJobId}`] },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

describe("mission control live page", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stacks thinking above output and keeps the live feed rail ahead of changed files and patch preview", async () => {
    vi.stubGlobal("EventSource", MockEventSource);

    const toolOutputPreview = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join("\n");
    const jobs = [
      buildJob({}),
      buildJob({
        id: recentJobId,
        type: "GenerateOnePager",
        status: "succeeded",
        startedAt: "2026-04-09T08:01:00.000Z",
        completedAt: "2026-04-09T08:20:00.000Z",
      }),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = typeof input === "string" ? input : input.toString();

        if (path === "/auth/me") {
          return jsonResponse({ user });
        }

        if (path === `/api/projects/${projectId}`) {
          return jsonResponse({
            id: projectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: user.id,
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-09T10:00:00.000Z",
          });
        }

        if (path === `/api/projects/${projectId}/jobs`) {
          return jsonResponse({ jobs });
        }

        if (path === `/api/jobs/${runningJobId}/live`) {
          return jsonResponse({
            snapshot: {
              job: jobs[0],
              events: [],
              changedFiles: [
                {
                  path: "apps/web/src/pages/MissionControlLivePage.tsx",
                  additions: 12,
                  deletions: 4,
                  binary: false,
                },
                {
                  path: "apps/web/src/components/workflow/MissionActivityTimeline.tsx",
                  additions: 8,
                  deletions: 2,
                  binary: false,
                },
              ],
              toolCalls: [
                {
                  id: "tool-call-1",
                  toolName: "shell",
                  status: "succeeded",
                  startedAt: "2026-04-09T10:02:00.000Z",
                  finishedAt: "2026-04-09T10:02:05.000Z",
                  durationMs: 5000,
                  inputPreview: "{\"command\":\"pnpm test\"}",
                  outputPreview: toolOutputPreview,
                  errorMessage: null,
                },
              ],
              llmSteps: [],
              outputLinks: [],
              transcript: {
                reasoning: "Reasoning stream",
                output: "Output stream",
              },
              relatedSandboxRun: null,
              latestSequence: 0,
            },
          });
        }

        if (
          path ===
          `/api/jobs/${runningJobId}/live/diff?path=apps%2Fweb%2Fsrc%2Fpages%2FMissionControlLivePage.tsx`
        ) {
          return jsonResponse({
            path: "apps/web/src/pages/MissionControlLivePage.tsx",
            patch: "@@ -1,2 +1,3 @@\n+stacked transcript",
          });
        }

        throw new Error(`Unhandled fetch for ${path}`);
      }),
    );

    renderLivePage();

    expect(await screen.findByRole("heading", { name: "Live Mission Control" })).toBeTruthy();

    const transcriptStack = screen.getByTestId("live-transcript-stack");
    const thinkingHeading = within(transcriptStack).getByText("Thinking");
    const outputHeading = within(transcriptStack).getByText("Output");
    expect(
      thinkingHeading.compareDocumentPosition(outputHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const rightRail = screen.getByTestId("live-right-rail");
    const rightRailCards = within(rightRail).getAllByTestId(
      /live-feed-card|changed-files-card|patch-preview-card/,
    );
    expect(rightRailCards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "live-feed-card",
      "changed-files-card",
      "patch-preview-card",
    ]);

    expect(
      await screen.findByText("apps/web/src/pages/MissionControlLivePage.tsx"),
    ).toBeTruthy();
    const patchPreview = screen.getByTestId("patch-preview-card");
    await waitFor(() => {
      const patchContent = patchPreview.querySelector("pre");
      expect(patchContent?.textContent).toBe("@@ -1,2 +1,3 @@\n+stacked transcript");
    });
    const outputPreview = await screen.findByTestId("tool-output-preview-tool-call-1");
    const previewContent = outputPreview.querySelector("pre");
    expect(previewContent?.textContent).toBe(toolOutputPreview);
    expect(previewContent?.className).toContain("max-h-[7rem]");
    expect(previewContent?.className).toContain("overflow-hidden");
  });

  it("keeps the activity timeline linked, shows failures, and preserves truncating job labels", () => {
    const longJobName = "GenerateMilestoneFeatureSet".repeat(4);
    const jobs = [
      buildJob({
        type: longJobName,
        status: "failed",
        error: { message: "Tool call failed" },
        completedAt: "2026-04-09T10:10:00.000Z",
      }),
    ];

    render(
      <AppProviders>
        <MemoryRouter>
          <MissionActivityTimeline jobs={jobs} projectId={projectId} />
        </MemoryRouter>
      </AppProviders>,
    );

    const jobLink = screen.getByRole("link", {
      name: /Generate Milestone Feature Set Generate Milestone Feature Set/i,
    });
    expect(jobLink.getAttribute("href")).toBe(`/projects/${projectId}/live/${runningJobId}`);
    expect(screen.getByText("Tool call failed")).toBeTruthy();

    const titleNode = within(jobLink).getByTitle(
      "Generate Milestone Feature Set Generate Milestone Feature Set Generate Milestone Feature Set Generate Milestone Feature Set",
    );
    expect(titleNode.className).toContain("truncate");
  });
});
