import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AutoAdvanceSession, User } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { MissionControlPage } from "../src/pages/MissionControlPage.js";

const projectId = "b278b3d6-4dba-4f78-88e5-4651dc289cb3";

const user: User = {
  id: "0f4366b6-b8dc-4ccb-b778-e158b20afb1f",
  avatarUrl: null,
  createdAt: "2026-03-15T00:00:00.000Z",
  displayName: "Harbor Admin",
  email: "harbor@example.com",
  updatedAt: "2026-03-15T00:00:00.000Z",
};

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const buildSession = (overrides: Partial<AutoAdvanceSession> = {}): AutoAdvanceSession => ({
  id: "97d3ae95-d3cb-453a-a0df-1f7d6169a3b5",
  projectId,
  status: "paused",
  currentStep: "project_setup",
  pausedReason: "needs_human",
  autoApproveWhenClear: false,
  skipReviewSteps: false,
  autoRepairMilestoneCoverage: false,
  creativityMode: "balanced",
  retryCount: 0,
  reviewCount: 0,
  milestoneRepairCount: 0,
  maxConcurrentJobs: 1,
  startedAt: "2026-03-30T12:00:00.000Z",
  pausedAt: "2026-03-30T12:00:01.000Z",
  completedAt: null,
  createdAt: "2026-03-30T12:00:00.000Z",
  updatedAt: "2026-03-30T12:00:01.000Z",
  ...overrides,
});

const renderMissionControl = () => {
  const routes = new Map<string, ReactNode>([
    ["/", <div />],
    ["/docs", <div />],
    ["/settings", <div />],
    ["/projects/:id", <MissionControlPage />],
    ["/projects/:id/settings", <div />],
    ["/projects/:id/setup", <div />],
    ["/projects/:id/questions", <div />],
    ["/projects/:id/one-pager", <div />],
    ["/projects/:id/product-spec", <div />],
    ["/projects/:id/user-flows", <div />],
    ["/projects/:id/ux-spec", <div />],
    ["/projects/:id/technical-spec", <div />],
    ["/projects/:id/milestones", <div />],
    ["/projects/:id/features", <div />],
  ]);
  const router = createMemoryRouter(
    Array.from(routes.entries()).map(([path, element]) => ({ path, element })),
    { initialEntries: [`/projects/${projectId}`] },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });

describe("auto-advance controls", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts an empty start payload when all options are left at defaults", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const startBodies: Array<Record<string, unknown>> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = typeof input === "string" ? input : input.toString();

        if (path === "/auth/me") {
          return jsonResponse({ user });
        }

        if (path === `/api/projects/${projectId}`) {
          return jsonResponse({
            id: projectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "EMPTY",
            ownerUserId: user.id,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          });
        }

        if (path === `/api/projects/${projectId}/phase-gates`) {
          return jsonResponse({ phases: [] });
        }

        if (path === `/api/projects/${projectId}/next-actions`) {
          return jsonResponse({
            actions: [
              {
                key: "project_setup",
                label: "Finish project setup",
                href: `/projects/${projectId}/setup`,
              },
            ],
          });
        }

        if (path === `/api/projects/${projectId}/jobs`) {
          return jsonResponse({ jobs: [] });
        }

        if (path === `/api/projects/${projectId}/auto-advance/status`) {
          return jsonResponse({ session: null, nextStep: "project_setup" });
        }

        if (path === `/api/projects/${projectId}/auto-advance/start`) {
          startBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
          return jsonResponse(buildSession());
        }

        throw new Error(`Unhandled fetch for ${path}`);
      }),
    );

    renderMissionControl();

    await userEvent.click(await screen.findByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(startBodies).toEqual([{}]);
    });
  });

  it("renders the backend error message when start fails", async () => {
    vi.stubGlobal("EventSource", MockEventSource);

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
            state: "EMPTY",
            ownerUserId: user.id,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          });
        }

        if (path === `/api/projects/${projectId}/phase-gates`) {
          return jsonResponse({ phases: [] });
        }

        if (path === `/api/projects/${projectId}/next-actions`) {
          return jsonResponse({ actions: [] });
        }

        if (path === `/api/projects/${projectId}/jobs`) {
          return jsonResponse({ jobs: [] });
        }

        if (path === `/api/projects/${projectId}/auto-advance/status`) {
          return jsonResponse({ session: null, nextStep: null });
        }

        if (path === `/api/projects/${projectId}/auto-advance/start`) {
          return jsonResponse(
            {
              error: {
                code: "invalid_request",
                message: "body must NOT have additional properties",
              },
            },
            { status: 400 },
          );
        }

        throw new Error(`Unhandled fetch for ${path}`);
      }),
    );

    renderMissionControl();

    await userEvent.click(await screen.findByRole("button", { name: "Start" }));

    expect(
      await screen.findByText("body must NOT have additional properties"),
    ).toBeTruthy();
  });
});
