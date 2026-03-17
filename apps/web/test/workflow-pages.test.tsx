import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { MissionControlPage } from "../src/pages/MissionControlPage.js";
import { OnePagerIntakePage } from "../src/pages/OnePagerIntakePage.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";
const user: User = {
  id: projectId,
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

const renderRoute = (path: string, element: ReactNode) => {
  const router = createMemoryRouter([{ path, element }], {
    initialEntries: [path.replace(":id", projectId)],
  });

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

describe("workflow pages", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the mission control queue and project navigation", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${projectId}`]: {
        id: projectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY_PARTIAL",
        ownerUserId: projectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${projectId}/setup-status`]: {
        repoConnected: true,
        llmVerified: false,
        sandboxVerified: true,
        checks: [],
      },
      [`/api/projects/${projectId}/phase-gates`]: {
        phases: [
          {
            phase: "Overview",
            passed: false,
            items: [
              { key: "questionnaire", label: "Questionnaire answered", passed: true },
              { key: "overview", label: "Overview approved", passed: false },
            ],
          },
        ],
      },
      [`/api/projects/${projectId}/next-actions`]: {
        actions: [
          {
            key: "review-overview",
            label: "Review overview draft",
            href: `/projects/${projectId}/one-pager`,
          },
        ],
      },
      [`/api/projects/${projectId}/jobs`]: {
        jobs: [
          {
            id: "d3057770-eca1-417a-a1c6-c00bb83a47d0",
            projectId,
            type: "generate_one_pager",
            status: "running",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T10:00:00.000Z",
            startedAt: "2026-03-16T10:01:00.000Z",
            completedAt: null,
          },
        ],
      },
    });

    renderRoute("/projects/:id", <MissionControlPage />);

    expect(await screen.findByRole("heading", { name: "Mission Control" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Project Setup" })).toBeTruthy();
    expect(screen.getByText("Review overview draft")).toBeTruthy();
    expect(screen.getByText("Recent Jobs")).toBeTruthy();
  });

  it("renders the overview document through the governed markdown surface", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${projectId}`]: {
        id: projectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY_PARTIAL",
        ownerUserId: projectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${projectId}/setup-status`]: {
        repoConnected: true,
        llmVerified: true,
        sandboxVerified: true,
        checks: [],
      },
      [`/api/projects/${projectId}/questionnaire-answers`]: {
        projectId,
        answers: {},
        updatedAt: "2026-03-16T09:00:00.000Z",
        completedAt: null,
      },
      [`/api/projects/${projectId}/one-pager`]: {
        onePager: {
          id: "14ec48cb-6248-4fd0-8df0-58bfa13f8370",
          projectId,
          version: 2,
          title: "Overview",
          markdown: "# Overview\n\nCanonical scope for the planning workspace.",
          source: "generated",
          isCanonical: true,
          approvedAt: null,
          createdAt: "2026-03-16T09:10:00.000Z",
        },
      },
      [`/api/projects/${projectId}/one-pager/versions`]: {
        versions: [
          {
            id: "14ec48cb-6248-4fd0-8df0-58bfa13f8370",
            projectId,
            version: 2,
            title: "Overview",
            markdown: "# Overview\n\nCanonical scope for the planning workspace.",
            source: "generated",
            isCanonical: true,
            approvedAt: null,
            createdAt: "2026-03-16T09:10:00.000Z",
          },
        ],
      },
      [`/api/projects/${projectId}/jobs`]: {
        jobs: [
          {
            id: "4c57d789-a423-46e0-8b36-c09f9e9d8ad8",
            projectId,
            type: "generate_one_pager",
            status: "succeeded",
            inputs: {},
            outputs: {},
            error: null,
            queuedAt: "2026-03-16T09:00:00.000Z",
            startedAt: "2026-03-16T09:01:00.000Z",
            completedAt: "2026-03-16T09:10:00.000Z",
          },
        ],
      },
    });

    renderRoute("/projects/:id/one-pager", <OnePagerIntakePage />);

    expect(
      await screen.findByRole("heading", { name: "Questionnaire And Overview Document" }),
    ).toBeTruthy();
    expect(screen.getByText("Current Overview")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();
    expect(screen.getByText("Background Jobs")).toBeTruthy();
  });
});
