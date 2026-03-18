import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { SetupCompletionGate } from "../src/components/layout/SetupCompletionGate.js";
import { MissionControlPage } from "../src/pages/MissionControlPage.js";
import { OnePagerOverviewPage } from "../src/pages/OnePagerOverviewPage.js";
import { OnePagerQuestionsPage } from "../src/pages/OnePagerQuestionsPage.js";
import { ProjectSetupPage } from "../src/pages/ProjectSetupPage.js";

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

const renderRoute = (path: string, element: ReactNode, routeProjectId = projectId) => {
  const routeEntries = new Map<string, ReactNode>([
    ["/", <div />],
    ["/docs", <div />],
    ["/settings", <div />],
    ["/projects/:id", <div />],
    ["/projects/:id/setup", <div />],
    ["/projects/:id/questions", <div />],
    ["/projects/:id/one-pager", <div />],
    ["/projects/:id/user-flows", <div />],
    ["/projects/:id/import", <div />],
  ]);
  routeEntries.set(path, element);
  const router = createMemoryRouter(
    Array.from(routeEntries.entries()).map(([routePath, routeElement]) => ({
      path: routePath,
      element: routeElement,
    })),
    {
      initialEntries: [path.replace(":id", routeProjectId)],
    },
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

describe("workflow pages", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  it("renders the questionnaire page and autosaves answers", async () => {
    const autosaveProjectId = "11111111-1111-4111-8111-111111111111";

    vi.stubGlobal("EventSource", MockEventSource);
    let answers = {} as Record<string, string>;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === `/api/projects/${autosaveProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: autosaveProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY_PARTIAL",
            ownerUserId: autosaveProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${autosaveProjectId}/setup-status` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            repoConnected: true,
            llmVerified: true,
            sandboxVerified: true,
            checks: [],
          }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${autosaveProjectId}/questionnaire-answers` &&
        method === "GET"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: autosaveProjectId,
            answers,
            updatedAt: "2026-03-16T09:00:00.000Z",
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${autosaveProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [],
          }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${autosaveProjectId}/questionnaire-answers` &&
        method === "PATCH"
      ) {
        const payload = JSON.parse(String(init?.body)) as { answers: Record<string, string> };
        answers = { ...answers, ...payload.answers };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: autosaveProjectId,
            answers,
            updatedAt: "2026-03-16T09:01:00.000Z",
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/questions", <OnePagerQuestionsPage />, autosaveProjectId);

    expect(await screen.findByText(/Saved/)).toBeTruthy();
    expect(screen.queryByText("Unsaved changes pending.")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Next: Generate Overview",
      }),
    ).toBeTruthy();
    const summaryField = await screen.findByLabelText("Project Summary");
    fireEvent.change(summaryField, { target: { value: "Planning workspace" } });
    fireEvent.blur(summaryField);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([path, init]) =>
          path === `/api/projects/${autosaveProjectId}/questionnaire-answers` &&
          init?.method === "PATCH",
      );

      expect(patchCall).toBeTruthy();
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        answers: {
          q1_name_and_description: "Planning workspace",
        },
      });
    });
  });

  it("moves Generate Answers into the questionnaire header and reflects running jobs", async () => {
    const autoAnswerProjectId = "12121212-1212-4212-8212-121212121212";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      [`/api/projects/${autoAnswerProjectId}`]: {
        id: autoAnswerProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY_PARTIAL",
        ownerUserId: autoAnswerProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${autoAnswerProjectId}/setup-status`]: {
        repoConnected: true,
        llmVerified: true,
        sandboxVerified: true,
        checks: [],
      },
      [`/api/projects/${autoAnswerProjectId}/questionnaire-answers`]: {
        projectId: autoAnswerProjectId,
        answers: {
          q1_name_and_description: "Planning workspace",
        },
        updatedAt: "2026-03-16T09:00:00.000Z",
        completedAt: null,
      },
      [`/api/projects/${autoAnswerProjectId}/jobs`]: {
        jobs: [
          {
            id: "8c2b3e2c-b40a-4d0f-9d1f-89d18133f8bb",
            projectId: autoAnswerProjectId,
            type: "AutoAnswerQuestionnaire",
            status: "running",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T09:00:00.000Z",
            startedAt: "2026-03-16T09:01:00.000Z",
            completedAt: null,
          },
        ],
      },
    });

    const { getByTestId } = renderRoute(
      "/projects/:id/questions",
      <OnePagerQuestionsPage />,
      autoAnswerProjectId,
    );

    expect(await screen.findByRole("button", { name: "Generating Answers" })).toBeTruthy();
    expect(
      within(getByTestId("questionnaire-header-actions")).getByRole("button", {
        name: "Generating Answers",
      }),
    ).toBeTruthy();
    expect(
      within(getByTestId("questionnaire-footer-actions")).queryByRole("button", {
        name: /Generate Answers/i,
      }),
    ).toBeNull();
    expect(
      within(getByTestId("questionnaire-footer-actions")).getByRole("button", {
        name: "Next: Generate Overview",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Questions" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBeNull();
  });

  it("queues auto-answer and starts the AI state immediately", async () => {
    const autoAnswerProjectId = "13131313-1313-4313-8313-131313131313";

    vi.stubGlobal("EventSource", MockEventSource);

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === `/api/projects/${autoAnswerProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: autoAnswerProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY_PARTIAL",
            ownerUserId: autoAnswerProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${autoAnswerProjectId}/setup-status` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            repoConnected: true,
            llmVerified: true,
            sandboxVerified: true,
            checks: [],
          }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${autoAnswerProjectId}/questionnaire-answers` &&
        method === "GET"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: autoAnswerProjectId,
            answers: {
              q1_name_and_description: "Planning workspace",
            },
            updatedAt: "2026-03-16T09:00:00.000Z",
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${autoAnswerProjectId}/questionnaire-answers` &&
        method === "PATCH"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: autoAnswerProjectId,
            answers: {
              q1_name_and_description: "Planning workspace",
            },
            updatedAt: "2026-03-16T09:01:00.000Z",
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${autoAnswerProjectId}/questionnaire-answers/auto-answer` &&
        method === "POST"
      ) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            id: "2d5728c9-4107-4ad1-ab46-d3fa333e4b98",
            projectId: autoAnswerProjectId,
            type: "AutoAnswerQuestionnaire",
            status: "queued",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T09:02:00.000Z",
            startedAt: null,
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${autoAnswerProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [],
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/questions", <OnePagerQuestionsPage />, autoAnswerProjectId);

    const generateAnswersButton = await screen.findByRole("button", {
      name: "Generate Answers",
    });

    fireEvent.click(generateAnswersButton);

    expect(await screen.findByRole("button", { name: "Generating Answers" })).toBeTruthy();
    await waitFor(() => {
      const requestCalls = fetchMock.mock.calls.map(([input, init]) => ({
        method: init?.method ?? "GET",
        path: typeof input === "string" ? input : input.toString(),
      }));
      const autoAnswerCall = requestCalls.findIndex(
        ({ path, method }) =>
          path === `/api/projects/${autoAnswerProjectId}/questionnaire-answers/auto-answer` &&
          method === "POST",
      );

      expect(autoAnswerCall).toBeGreaterThanOrEqual(0);
    });
  });

  it("renders the overview document through the editable markdown surface", async () => {
    const overviewProjectId = "22222222-2222-4222-8222-222222222222";

    vi.stubGlobal("EventSource", MockEventSource);
    let onePager = {
      id: "14ec48cb-6248-4fd0-8df0-58bfa13f8370",
      projectId: overviewProjectId,
      version: 2,
      title: "Overview",
      markdown: "# Overview\n\nCanonical scope for the planning workspace.",
      source: "generated",
      isCanonical: true,
      approvedAt: null,
      createdAt: "2026-03-16T09:10:00.000Z",
    };
    let versions = [onePager];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me" && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: overviewProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY_PARTIAL",
            ownerUserId: overviewProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/setup-status` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            repoConnected: true,
            llmVerified: true,
            sandboxVerified: true,
            checks: [],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/questionnaire-answers` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: overviewProjectId,
            answers: {},
            updatedAt: "2026-03-16T09:00:00.000Z",
            completedAt: "2026-03-16T09:05:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/one-pager` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ onePager }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/one-pager` && method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as { markdown: string };
        onePager = {
          ...onePager,
          id: "a9dc6076-20da-43b0-84fb-e8cac2409318",
          version: 3,
          markdown: payload.markdown,
          source: "ManualEdit",
          approvedAt: null,
          createdAt: "2026-03-16T09:12:00.000Z",
        };
        versions = [onePager, ...versions.map((version) => ({ ...version, isCanonical: false }))];

        return {
          ok: true,
          status: 200,
          json: async () => onePager,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/one-pager/versions` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [
              {
                id: "4c57d789-a423-46e0-8b36-c09f9e9d8ad8",
                projectId: overviewProjectId,
                type: "GenerateProjectOverview",
                status: "succeeded",
                inputs: {},
                outputs: {},
                error: null,
                queuedAt: "2026-03-16T09:00:00.000Z",
                startedAt: "2026-03-16T09:01:00.000Z",
                completedAt: "2026-03-16T09:10:00.000Z",
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/phase-gates` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ phases: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/next-actions` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ actions: [] }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/one-pager", <OnePagerOverviewPage />, overviewProjectId);

    expect(await screen.findByRole("heading", { name: "Generated Overview" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Regenerate Overview" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Edit Markdown" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();
    expect(screen.getByText("Background Jobs")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "# Overview\n\nExpanded canonical scope for the planning workspace." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Overview" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === `/api/projects/${overviewProjectId}/one-pager` && init?.method === "PATCH",
        ),
      ).toBe(true);
    });

    expect(
      await screen.findByText("Expanded canonical scope for the planning workspace."),
    ).toBeTruthy();
    expect(await screen.findByText("Version 3 (canonical)")).toBeTruthy();
  });

  it("uses the AI button state while overview generation is running", async () => {
    const overviewProjectId = "20202020-2020-4020-8020-202020202020";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      [`/api/projects/${overviewProjectId}`]: {
        id: overviewProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY_PARTIAL",
        ownerUserId: overviewProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${overviewProjectId}/setup-status`]: {
        repoConnected: true,
        llmVerified: true,
        sandboxVerified: true,
        checks: [],
      },
      [`/api/projects/${overviewProjectId}/questionnaire-answers`]: {
        projectId: overviewProjectId,
        answers: {},
        updatedAt: "2026-03-16T09:00:00.000Z",
        completedAt: "2026-03-16T09:05:00.000Z",
      },
      [`/api/projects/${overviewProjectId}/one-pager`]: {
        onePager: {
          id: "14ec48cb-6248-4fd0-8df0-58bfa13f8370",
          projectId: overviewProjectId,
          version: 2,
          title: "Overview",
          markdown: "# Overview\n\nCanonical scope for the planning workspace.",
          source: "generated",
          isCanonical: true,
          approvedAt: null,
          createdAt: "2026-03-16T09:10:00.000Z",
        },
      },
      [`/api/projects/${overviewProjectId}/one-pager/versions`]: {
        versions: [
          {
            id: "14ec48cb-6248-4fd0-8df0-58bfa13f8370",
            projectId: overviewProjectId,
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
      [`/api/projects/${overviewProjectId}/jobs`]: {
        jobs: [
          {
            id: "4c57d789-a423-46e0-8b36-c09f9e9d8ad8",
            projectId: overviewProjectId,
            type: "GenerateProjectOverview",
            status: "running",
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

    renderRoute("/projects/:id/one-pager", <OnePagerOverviewPage />, overviewProjectId);

    expect(await screen.findByRole("heading", { name: "Generated Overview" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Generating Overview" })).toBeTruthy();
  });

  it("redirects incomplete overview access back to setup until setup is explicitly completed", async () => {
    const lockedProjectId = "33333333-3333-4333-8333-333333333333";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      [`/api/projects/${lockedProjectId}`]: {
        id: lockedProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "BOOTSTRAPPING",
        ownerUserId: lockedProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${lockedProjectId}/setup`]: {
        evidencePolicy: {
          requireArchitectureDocs: false,
          requireUserDocs: false,
        },
        llm: {
          availableModels: ["llama3.2"],
          model: "llama3.2",
          provider: "ollama",
          verified: true,
        },
        repo: {
          availableRepos: [
            {
              owner: "acme",
              repo: "service-api",
              fullName: "acme/service-api",
              defaultBranch: "main",
              repoUrl: "https://github.com/acme/service-api",
            },
          ],
          patConfigured: true,
          selectedRepo: {
            owner: "acme",
            repo: "service-api",
            fullName: "acme/service-api",
            defaultBranch: "main",
            repoUrl: "https://github.com/acme/service-api",
          },
          viewerLogin: "acme-admin",
        },
        sandboxConfig: {
          allowlist: [],
          cpuLimit: 1,
          egressPolicy: "locked",
          memoryMb: 1024,
          timeoutSeconds: 300,
        },
        status: {
          repoConnected: true,
          llmVerified: true,
          sandboxVerified: true,
          checks: [],
        },
      },
    });

    const router = createMemoryRouter(
      [
        { path: "/", element: <div /> },
        { path: "/docs", element: <div /> },
        { path: "/settings", element: <div /> },
        { path: "/projects/:id", element: <div /> },
        {
          element: <SetupCompletionGate />,
          children: [
            { path: "/projects/:id/questions", element: <OnePagerQuestionsPage /> },
          ],
        },
        {
          path: "/projects/:id/setup",
          element: <ProjectSetupPage />,
        },
        { path: "/projects/:id/one-pager", element: <div /> },
        { path: "/projects/:id/user-flows", element: <div /> },
        { path: "/projects/:id/import", element: <div /> },
      ],
      {
        initialEntries: [`/projects/${lockedProjectId}/questions`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    expect(
      screen.getByText(
        /Complete setup to unlock Questions, Overview, User Flows, and Import\. You were redirected from/,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Questions" })).toBeNull();
  });
});
