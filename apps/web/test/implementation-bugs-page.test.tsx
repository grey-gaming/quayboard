import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../src/app.js";
import { ImplementationBugsPage } from "../src/pages/ImplementationBugsPage.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const renderPage = () => {
  const router = createMemoryRouter(
    [
      { path: "/", element: <div /> },
      { path: "/docs", element: <div /> },
      { path: "/settings", element: <div /> },
      { path: "/projects/:id", element: <div /> },
      { path: "/projects/:id/settings", element: <div /> },
      { path: "/projects/:id/develop", element: <div /> },
      { path: "/projects/:id/develop/review", element: <div /> },
      { path: "/projects/:id/develop/debug", element: <div /> },
      { path: "/projects/:id/develop/bugs", element: <ImplementationBugsPage /> },
    ],
    {
      initialEntries: [`/projects/${projectId}/develop/bugs`],
    },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImplementationBugsPage", () => {
  it("creates, edits, and queues fixes for bugs", async () => {
    vi.stubGlobal("EventSource", MockEventSource);

    let bugs = [
      {
        id: "bug-open-1",
        projectId,
        featureId: "feature-1",
        implementationRecordId: "impl-1",
        description: "Open bug description",
        status: "open",
        reportedByUserId: projectId,
        latestFixJobId: null,
        latestFixSandboxRunId: null,
        latestFixPullRequestUrl: null,
        lastFixError: null,
        fixedAt: null,
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
      },
      {
        id: "bug-fixed-1",
        projectId,
        featureId: null,
        implementationRecordId: null,
        description: "Already fixed",
        status: "fixed",
        reportedByUserId: projectId,
        latestFixJobId: "job-1",
        latestFixSandboxRunId: "run-1",
        latestFixPullRequestUrl: "https://github.com/acme/repo/pull/1",
        lastFixError: null,
        fixedAt: "2026-04-08T11:00:00.000Z",
        createdAt: "2026-04-08T09:00:00.000Z",
        updatedAt: "2026-04-08T11:00:00.000Z",
      },
    ];

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: {
              id: projectId,
              email: "owner@example.com",
              displayName: "Owner",
              avatarUrl: null,
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${projectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: projectId,
            name: "Quayboard",
            description: "Governed planning workspace.",
            state: "COMPLETED",
            ownerUserId: projectId,
            milestonePlanStatus: "finalized",
            milestonePlanFinalizedAt: "2026-04-08T09:00:00.000Z",
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-08T00:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${projectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${projectId}/features`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            features: [
              {
                id: "feature-1",
                projectId,
                milestoneId: "milestone-1",
                featureKey: "F-001",
                status: "approved",
                priority: "must_have",
                kind: "screen",
                dependencyIds: [],
                headRevision: {
                  id: "feature-rev-1",
                  featureId: "feature-1",
                  version: 1,
                  title: "Task Board",
                  summary: "Task board feature.",
                  rationale: null,
                  status: "approved",
                  source: "manual",
                  createdAt: "2026-04-08T00:00:00.000Z",
                  approvedAt: "2026-04-08T00:00:00.000Z",
                },
                createdAt: "2026-04-08T00:00:00.000Z",
                updatedAt: "2026-04-08T00:00:00.000Z",
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${projectId}/bugs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ bugs }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${projectId}/bugs` && method === "POST") {
        const payload = JSON.parse(String(init?.body)) as { description: string; featureId?: string };
        bugs = [
          {
            id: "bug-open-2",
            projectId,
            featureId: payload.featureId ?? null,
            implementationRecordId: null,
            description: payload.description,
            status: "open",
            reportedByUserId: projectId,
            latestFixJobId: null,
            latestFixSandboxRunId: null,
            latestFixPullRequestUrl: null,
            lastFixError: null,
            fixedAt: null,
            createdAt: "2026-04-08T12:00:00.000Z",
            updatedAt: "2026-04-08T12:00:00.000Z",
          },
          ...bugs,
        ];
        return {
          ok: true,
          status: 200,
          json: async () => bugs[0],
        } satisfies Partial<Response>;
      }

      if (path === "/api/bugs/bug-open-1" && method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as { description?: string; featureId?: string | null };
        bugs = bugs.map((bug) =>
          bug.id === "bug-open-1"
            ? {
                ...bug,
                description: payload.description ?? bug.description,
                featureId: payload.featureId === undefined ? bug.featureId : payload.featureId,
                updatedAt: "2026-04-08T12:30:00.000Z",
              }
            : bug,
        );
        return {
          ok: true,
          status: 200,
          json: async () => bugs.find((bug) => bug.id === "bug-open-1"),
        } satisfies Partial<Response>;
      }

      if (path === "/api/bugs/bug-open-1/fix" && method === "POST") {
        bugs = bugs.map((bug) =>
          bug.id === "bug-open-1"
            ? {
                ...bug,
                status: "in_progress",
                latestFixJobId: "job-fix-1",
                updatedAt: "2026-04-08T13:00:00.000Z",
              }
            : bug,
        );
        return {
          ok: true,
          status: 200,
          json: async () => bugs.find((bug) => bug.id === "bug-open-1"),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Bugs" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A newly reported bug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create bug" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === `/api/projects/${projectId}/bugs` && init?.method === "POST",
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]!);
    fireEvent.change(screen.getByDisplayValue("Open bug description"), {
      target: { value: "Edited bug description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) => path === "/api/bugs/bug-open-1" && init?.method === "PATCH",
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Fix" })[1]!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) => path === "/api/bugs/bug-open-1/fix" && init?.method === "POST",
        ),
      ).toBe(true);
    });
  });
});
