import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecisionCard, Job, User, UseCaseListResponse } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { OverviewApprovalGate } from "../src/components/layout/OverviewApprovalGate.js";
import { ProductSpecApprovalGate } from "../src/components/layout/ProductSpecApprovalGate.js";
import { SetupCompletionGate } from "../src/components/layout/SetupCompletionGate.js";
import { TechnicalSpecApprovalGate } from "../src/components/layout/TechnicalSpecApprovalGate.js";
import { UserFlowsApprovalGate } from "../src/components/layout/UserFlowsApprovalGate.js";
import { FeatureBuilderPage } from "../src/pages/FeatureBuilderPage.js";
import { MilestonesPage } from "../src/pages/MilestonesPage.js";
import { MissionControlPage } from "../src/pages/MissionControlPage.js";
import { FeatureEditorPage } from "../src/pages/FeatureEditorPage.js";
import { OnePagerOverviewPage } from "../src/pages/OnePagerOverviewPage.js";
import { OnePagerQuestionsPage } from "../src/pages/OnePagerQuestionsPage.js";
import { ProductSpecPage } from "../src/pages/ProductSpecPage.js";
import { ProjectSetupPage } from "../src/pages/ProjectSetupPage.js";
import { TechnicalSpecPage } from "../src/pages/TechnicalSpecPage.js";
import { UxSpecPage } from "../src/pages/UxSpecPage.js";
import { UserFlowsPage } from "../src/pages/UserFlowsPage.js";

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
  static instances: MockEventSource[] = [];

  static emit(eventName: string, data: unknown) {
    const messageEvent = { data: JSON.stringify(data) } as MessageEvent<string>;

    for (const instance of MockEventSource.instances) {
      const handlers = instance.listeners.get(eventName) ?? [];
      for (const handler of handlers) {
        handler(messageEvent);
      }
    }
  }

  static reset() {
    MockEventSource.instances = [];
  }

  private listeners = new Map<string, Array<(event: Event) => void>>();

  constructor() {
    MockEventSource.instances.push(this);
  }

  addEventListener(eventName: string, handler: (event: Event) => void) {
    const handlers = this.listeners.get(eventName) ?? [];
    handlers.push(handler);
    this.listeners.set(eventName, handlers);
  }

  removeEventListener(eventName: string, handler: (event: Event) => void) {
    const handlers = this.listeners.get(eventName) ?? [];
    this.listeners.set(
      eventName,
      handlers.filter((currentHandler) => currentHandler !== handler),
    );
  }

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
    ["/projects/:id/product-spec", <div />],
    ["/projects/:id/user-flows", <div />],
    ["/projects/:id/ux-spec", <div />],
    ["/projects/:id/technical-spec", <div />],
    ["/projects/:id/milestones", <div />],
    ["/projects/:id/features", <div />],
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
    MockEventSource.reset();
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
            phase: "Overview Document",
            passed: false,
            items: [
              { key: "questionnaire", label: "Questionnaire complete", passed: true },
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
    expect(screen.getByRole("link", { name: "Setup" })).toBeTruthy();
    expect(screen.getByText("Review overview draft")).toBeTruthy();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.queryByText("Pipeline map")).toBeNull();
  });

  it("orders mission control phases with user flows after the spec phases", async () => {
    const orderedProjectId = "f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${orderedProjectId}`]: {
        id: orderedProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: orderedProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${orderedProjectId}/phase-gates`]: {
        phases: [
          { phase: "User Flows", passed: false, items: [] },
          { phase: "Technical Spec", passed: false, items: [] },
          { phase: "Project Setup", passed: true, items: [] },
          { phase: "UX Spec", passed: false, items: [] },
          { phase: "Product Spec", passed: true, items: [] },
          { phase: "Overview Document", passed: true, items: [] },
        ],
      },
      [`/api/projects/${orderedProjectId}/next-actions`]: {
        actions: [],
      },
      [`/api/projects/${orderedProjectId}/jobs`]: {
        jobs: [],
      },
    });

    renderRoute("/projects/:id", <MissionControlPage />, orderedProjectId);

    expect(await screen.findByRole("heading", { name: "Mission Control" })).toBeTruthy();
    const phaseGates = screen.getByTestId("mission-control-phase-gates");

    expect(
      within(phaseGates)
        .getAllByText(/Project Setup|Overview Document|Product Spec|UX Spec|Technical Spec|User Flows/)
        .map((node) => node.textContent)
        .slice(0, 6),
    ).toEqual([
      "Project Setup",
      "Overview Document",
      "Product Spec",
      "UX Spec",
      "Technical Spec",
      "User Flows",
    ]);
  });

  it("renders milestone planning with design-doc approval controls", async () => {
    const milestoneProjectId = "92929292-9292-4292-8292-929292929292";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${milestoneProjectId}`]: {
        id: milestoneProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: milestoneProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${milestoneProjectId}/phase-gates`]: {
        phases: [
          {
            phase: "Milestones",
            passed: false,
            items: [{ key: "approved-user-flows", label: "Approved user flows", passed: true }],
          },
          {
            phase: "Features",
            passed: false,
            items: [{ key: "approved-milestone", label: "Approved milestone exists", passed: true }],
          },
        ],
      },
      [`/api/projects/${milestoneProjectId}/user-flows`]: {
        userFlows: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            projectId: milestoneProjectId,
            title: "Plan delivery milestones",
            userStory: "As a planner, I want a roadmap so delivery can start.",
            entryPoint: "Mission Control",
            endState: "The roadmap is approved.",
            flowSteps: ["Open Mission Control", "Create milestones"],
            coverageTags: ["happy-path", "onboarding"],
            acceptanceCriteria: ["A first increment exists."],
            doneCriteriaRefs: ["DC-1"],
            source: "ManualSave",
            archivedAt: null,
            createdAt: "2026-03-16T10:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          },
        ],
        coverage: { warnings: [], acceptedWarnings: [] },
        approvedAt: "2026-03-16T10:01:00.000Z",
      } satisfies UseCaseListResponse,
      [`/api/projects/${milestoneProjectId}/milestones`]: {
        milestones: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            projectId: milestoneProjectId,
            position: 1,
            title: "Foundations",
            summary: "Establish the first releasable increment.",
            status: "approved",
            linkedUserFlows: [
              { id: "11111111-1111-4111-8111-111111111111", title: "Plan delivery milestones" },
            ],
            featureCount: 2,
            approvedAt: "2026-03-16T10:02:00.000Z",
            createdAt: "2026-03-16T10:00:00.000Z",
            updatedAt: "2026-03-16T10:02:00.000Z",
          },
        ],
        coverage: {
          approvedUserFlowCount: 1,
          coveredUserFlowCount: 1,
          uncoveredUserFlowIds: [],
        },
      },
      "/api/milestones/22222222-2222-4222-8222-222222222222/design-docs": {
        designDocs: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            milestoneId: "22222222-2222-4222-8222-222222222222",
            version: 1,
            title: "Foundations design",
            markdown: "# Foundations\n\nRoadmap details.",
            source: "GenerateMilestoneDesign",
            isCanonical: true,
            createdAt: "2026-03-16T10:03:00.000Z",
            approval: null,
          },
        ],
      },
    });

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Milestones" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Milestone Document" }));
    expect(await screen.findByRole("button", { name: "Approve design doc" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Markdown" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
    expect(screen.queryByText("Milestone Gates")).toBeNull();
    expect(screen.getByText("Coverage check")).toBeTruthy();
  });

  it("reveals the create milestone panel and submits linked flows as checkboxes", async () => {
    const milestoneProjectId = "91919191-9191-4191-8191-919191919191";
    let milestonesResponse = {
      milestones: [] as Array<Record<string, unknown>>,
      coverage: {
        approvedUserFlowCount: 2,
        coveredUserFlowCount: 0,
        uncoveredUserFlowIds: ["flow-a", "flow-b"],
      },
    };
    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: milestoneProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: milestoneProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "flow-a",
                projectId: milestoneProjectId,
                title: "Planner creates milestones",
                userStory: "As a planner, I want to create milestones.",
                entryPoint: "Milestones",
                endState: "Milestones exist",
                flowSteps: ["Open milestones", "Add milestone"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["Milestone is saved."],
                doneCriteriaRefs: ["DC-1"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-20T09:00:00.000Z",
                updatedAt: "2026-03-20T09:00:00.000Z",
              },
              {
                id: "flow-b",
                projectId: milestoneProjectId,
                title: "Planner covers release goal",
                userStory: "As a planner, I want coverage across release flows.",
                entryPoint: "Milestones",
                endState: "Coverage is linked",
                flowSteps: ["Open milestones", "Select linked flows"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["Linked flows are persisted."],
                doneCriteriaRefs: ["DC-2"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-20T09:05:00.000Z",
                updatedAt: "2026-03-20T09:05:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: "2026-03-20T09:30:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => milestonesResponse,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones` && method === "POST") {
        expect(init?.body).toEqual(
          JSON.stringify({
            title: "Release Foundations",
            summary: "Ship the first release increment.",
            useCaseIds: ["flow-a", "flow-b"],
          }),
        );

        milestonesResponse = {
          milestones: [
            {
              id: "milestone-1",
              projectId: milestoneProjectId,
              position: 1,
              title: "Release Foundations",
              summary: "Ship the first release increment.",
              status: "draft",
              linkedUserFlows: [
                { id: "flow-a", title: "Planner creates milestones" },
                { id: "flow-b", title: "Planner covers release goal" },
              ],
              featureCount: 0,
              approvedAt: null,
              createdAt: "2026-03-20T10:00:00.000Z",
              updatedAt: "2026-03-20T10:00:00.000Z",
            },
          ],
          coverage: {
            approvedUserFlowCount: 2,
            coveredUserFlowCount: 2,
            uncoveredUserFlowIds: [],
          },
        };

        return {
          ok: true,
          status: 200,
          json: async () => milestonesResponse.milestones[0],
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Milestone" }));

    expect(await screen.findByRole("textbox", { name: "Title" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Release Foundations" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), {
      target: { value: "Ship the first release increment." },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Planner creates milestones" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Planner covers release goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
    });
    expect(screen.getByText("Release Foundations")).toBeTruthy();
  });

  it("blocks milestone approval until a design doc exists", async () => {
    const milestoneProjectId = "83838383-8383-4383-8383-838383838383";

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: milestoneProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: milestoneProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "flow-blocked",
                projectId: milestoneProjectId,
                title: "Plan delivery milestones",
                userStory: "As a planner, I want a roadmap so delivery can start.",
                entryPoint: "Mission Control",
                endState: "Milestone ready for approval",
                flowSteps: ["Open milestones", "Prepare design doc"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["A design doc exists before approval."],
                doneCriteriaRefs: ["DC-1"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:00:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: "2026-03-16T10:01:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            milestones: [
              {
                id: "milestone-blocked",
                projectId: milestoneProjectId,
                position: 1,
                title: "Foundations",
                summary: "Establish the first releasable increment.",
                status: "draft",
                linkedUserFlows: [{ id: "flow-blocked", title: "Plan delivery milestones" }],
                featureCount: 0,
                approvedAt: null,
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:00:00.000Z",
              },
            ],
            coverage: {
              approvedUserFlowCount: 1,
              coveredUserFlowCount: 1,
              uncoveredUserFlowIds: [],
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === "/api/milestones/milestone-blocked" && method === "POST") {
        return {
          ok: false,
          status: 409,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            error: {
              code: "milestone_design_doc_required",
              message: "Create a milestone design document before approving the milestone.",
            },
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(
      await screen.findByText("Create a milestone design document before approving the milestone."),
    ).toBeTruthy();
  });

  it("refreshes the design doc approval state after milestone approval", async () => {
    const milestoneProjectId = "83838383-8383-4383-8383-838383838384";
    let milestoneStatus: "draft" | "approved" = "draft";
    let designDocApproval: null | { approvedAt: string } = null;

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: milestoneProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: milestoneProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "flow-auto-approve",
                projectId: milestoneProjectId,
                title: "Plan delivery milestones",
                userStory: "As a planner, I want milestone approval to finalize the document.",
                entryPoint: "Milestones",
                endState: "Milestone approved",
                flowSteps: ["Open milestones", "Approve milestone"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["Milestone approval finalizes the design doc."],
                doneCriteriaRefs: ["DC-1"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:00:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: "2026-03-16T10:01:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            milestones: [
              {
                id: "milestone-auto-approve",
                projectId: milestoneProjectId,
                position: 1,
                title: "Foundations",
                summary: "Establish the first releasable increment.",
                status: milestoneStatus,
                linkedUserFlows: [{ id: "flow-auto-approve", title: "Plan delivery milestones" }],
                featureCount: 0,
                approvedAt:
                  milestoneStatus === "approved" ? "2026-03-16T10:05:00.000Z" : null,
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:05:00.000Z",
              },
            ],
            coverage: {
              approvedUserFlowCount: 1,
              coveredUserFlowCount: 1,
              uncoveredUserFlowIds: [],
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === "/api/milestones/milestone-auto-approve/design-docs") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            designDocs: [
              {
                id: "doc-auto-approve",
                milestoneId: "milestone-auto-approve",
                version: 1,
                title: "Foundations design",
                markdown: "# Foundations\n\nInitial copy.",
                source: "ManualSave",
                isCanonical: true,
                createdAt: "2026-03-16T10:04:00.000Z",
                approval: designDocApproval,
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === "/api/milestones/milestone-auto-approve" && method === "POST") {
        milestoneStatus = "approved";
        designDocApproval = { approvedAt: "2026-03-16T10:05:00.000Z" };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "milestone-auto-approve",
            projectId: milestoneProjectId,
            position: 1,
            title: "Foundations",
            summary: "Establish the first releasable increment.",
            status: "approved",
            linkedUserFlows: [{ id: "flow-auto-approve", title: "Plan delivery milestones" }],
            featureCount: 0,
            approvedAt: "2026-03-16T10:05:00.000Z",
            createdAt: "2026-03-16T10:00:00.000Z",
            updatedAt: "2026-03-16T10:05:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Milestone Document" }));
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
    expect(await screen.findByText("Foundations design")).toBeTruthy();
    expect(await screen.findByText("approval required")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.queryByText("approval required")).toBeNull();
    });
    expect(screen.getAllByText("approved")).toHaveLength(2);
  });

  it("tracks milestone generation jobs and surfaces failures", async () => {
    const milestoneProjectId = "84848484-8484-4484-8484-848484848484";
    let jobsResponse: { jobs: Job[] } = { jobs: [] };

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === "string" ? input : input.toString();

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: milestoneProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: milestoneProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "flow-1",
                projectId: milestoneProjectId,
                title: "Approve roadmap",
                userStory: "As a planner, I want milestones so I can sequence delivery.",
                entryPoint: "Mission Control",
                endState: "Milestones exist",
                flowSteps: ["Open milestones", "Generate milestones"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["Milestones are created."],
                doneCriteriaRefs: ["DC-1"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-20T09:00:00.000Z",
                updatedAt: "2026-03-20T09:00:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: "2026-03-20T09:30:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            milestones: [],
            coverage: {
              approvedUserFlowCount: 1,
              coveredUserFlowCount: 0,
              uncoveredUserFlowIds: ["flow-1"],
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => jobsResponse,
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    jobsResponse = {
      jobs: [
        {
          id: "job-milestones-running",
          projectId: milestoneProjectId,
          type: "GenerateMilestones",
          status: "running",
          inputs: {},
          outputs: null,
          error: null,
          queuedAt: "2026-03-20T10:00:00.000Z",
          startedAt: "2026-03-20T10:00:30.000Z",
          completedAt: null,
        },
      ],
    };
    MockEventSource.emit("job:updated", {
      jobId: "job-milestones-running",
      projectId: milestoneProjectId,
      status: "running",
    });
    expect(
      await screen.findByText(
        "Milestone generation is running. The page will refresh automatically when the job completes.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generating milestones..." })).toBeTruthy();

    jobsResponse = {
      jobs: [
        {
          id: "job-milestones-failed",
          projectId: milestoneProjectId,
          type: "GenerateMilestones",
          status: "failed",
          inputs: {},
          outputs: null,
          error: {
            message: "GenerateMilestones returned invalid content. Expected a JSON array of milestones.",
          },
          queuedAt: "2026-03-20T10:00:00.000Z",
          startedAt: "2026-03-20T10:00:30.000Z",
          completedAt: "2026-03-20T10:01:00.000Z",
        },
      ],
    };

    MockEventSource.emit("job:updated", {
      jobId: "job-milestones-failed",
      projectId: milestoneProjectId,
      status: "failed",
    });

    expect(await screen.findByText("Milestone generation failed.")).toBeTruthy();
    expect(
      screen.getByText(
        "GenerateMilestones returned invalid content. Expected a JSON array of milestones.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Milestones" })).toBeTruthy();
  });

  it("tracks milestone design doc jobs for the inline milestone card and surfaces failures", async () => {
    const milestoneProjectId = "85858585-8585-4585-8585-858585858585";
    const milestoneId = "95959595-9595-4595-8595-959595959595";
    let jobsResponse: { jobs: Job[] } = { jobs: [] };
    let designDocsResponse = { designDocs: [] as Array<Record<string, unknown>> };

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === "string" ? input : input.toString();

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: milestoneProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: milestoneProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "flow-2",
                projectId: milestoneProjectId,
                title: "Ship first release",
                userStory: "As a planner, I want a release milestone so delivery can start.",
                entryPoint: "Milestones",
                endState: "Milestone approved",
                flowSteps: ["Open milestones", "Review design doc"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["Design doc exists."],
                doneCriteriaRefs: ["DC-2"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-20T09:00:00.000Z",
                updatedAt: "2026-03-20T09:00:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: "2026-03-20T09:30:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            milestones: [
              {
                id: milestoneId,
                projectId: milestoneProjectId,
                position: 1,
                title: "Foundations",
                summary: "Prepare the first releasable increment.",
                status: "approved",
                linkedUserFlows: [{ id: "flow-2", title: "Ship first release" }],
                featureCount: 0,
                approvedAt: "2026-03-20T10:00:00.000Z",
                createdAt: "2026-03-20T09:45:00.000Z",
                updatedAt: "2026-03-20T10:00:00.000Z",
              },
            ],
            coverage: {
              approvedUserFlowCount: 1,
              coveredUserFlowCount: 1,
              uncoveredUserFlowIds: [],
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => jobsResponse,
        } satisfies Partial<Response>;
      }

      if (path === `/api/milestones/${milestoneId}/design-docs`) {
        return {
          ok: true,
          status: 200,
          json: async () => designDocsResponse,
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Milestone Document" }));
    jobsResponse = {
      jobs: [
        {
          id: "job-design-running",
          projectId: milestoneProjectId,
          type: "GenerateMilestoneDesign",
          status: "running",
          inputs: { milestoneId },
          outputs: null,
          error: null,
          queuedAt: "2026-03-20T11:00:00.000Z",
          startedAt: "2026-03-20T11:00:30.000Z",
          completedAt: null,
        },
      ],
    };
    MockEventSource.emit("job:updated", {
      jobId: "job-design-running",
      projectId: milestoneProjectId,
      status: "running",
    });
    expect(
      await screen.findByText(
        "Milestone design doc generation is running. The milestone card will refresh automatically when the job completes.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generating..." })).toBeTruthy();

    jobsResponse = { jobs: [] };
    designDocsResponse = {
      designDocs: [
        {
          id: "doc-1",
          milestoneId,
          version: 1,
          title: "Foundations design",
          markdown:
            "# Foundations\n\n## Delivery Shape\n\nShipped via job completion.\n\n### Exit Criteria\n\nShip with the generated design doc.",
          source: "GenerateMilestoneDesign",
          isCanonical: true,
          createdAt: "2026-03-20T11:01:00.000Z",
          approval: null,
        },
      ],
    };

    MockEventSource.emit("job:updated", {
      jobId: "job-design-running",
      projectId: milestoneProjectId,
      status: "completed",
    });

    expect(await screen.findByText("Foundations design")).toBeTruthy();
    expect(screen.getByRole("button", { name: "On This Page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve design doc" })).toBeTruthy();

    jobsResponse = {
      jobs: [
        {
          id: "job-design-failed",
          projectId: milestoneProjectId,
          type: "GenerateMilestoneDesign",
          status: "failed",
          inputs: { milestoneId },
          outputs: null,
          error: {
            message: "GenerateMilestoneDesign only runs for milestones that are not approved yet.",
          },
          queuedAt: "2026-03-20T11:00:00.000Z",
          startedAt: "2026-03-20T11:00:30.000Z",
          completedAt: "2026-03-20T11:01:00.000Z",
        },
      ],
    };

    MockEventSource.emit("job:updated", {
      jobId: "job-design-failed",
      projectId: milestoneProjectId,
      status: "failed",
    });

    expect(await screen.findByText("Milestone design doc generation failed.")).toBeTruthy();
    expect(
      screen.getByText("GenerateMilestoneDesign only runs for milestones that are not approved yet."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Design Document" })).toBeTruthy();
  });

  it("edits milestone markdown from the open document panel", async () => {
    const milestoneProjectId = "86868686-8686-4686-8686-868686868686";
    const milestoneId = "97979797-9797-4797-8797-979797979797";
    let designDocsResponse = {
      designDocs: [
        {
          id: "doc-edit-1",
          milestoneId,
          version: 1,
          title: "Foundations design",
          markdown: "# Foundations\n\nInitial copy.",
          source: "GenerateMilestoneDesign",
          isCanonical: true,
          createdAt: "2026-03-20T11:01:00.000Z",
          approval: null,
        },
      ],
    };

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: milestoneProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: milestoneProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "flow-3",
                projectId: milestoneProjectId,
                title: "Ship foundations",
                userStory: "As a planner, I want the milestone document editable.",
                entryPoint: "Milestones",
                endState: "Document saved",
                flowSteps: ["Open milestone", "Edit markdown"],
                coverageTags: ["happy-path"],
                acceptanceCriteria: ["Document is updated."],
                doneCriteriaRefs: ["DC-3"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-20T09:00:00.000Z",
                updatedAt: "2026-03-20T09:00:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: "2026-03-20T09:30:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/milestones`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            milestones: [
              {
                id: milestoneId,
                projectId: milestoneProjectId,
                position: 1,
                title: "Foundations",
                summary: "Prepare the first releasable increment.",
                status: "draft",
                isActive: true,
                linkedUserFlows: [{ id: "flow-3", title: "Ship foundations" }],
                featureCount: 0,
                approvedAt: null,
                completedAt: null,
                reconciliationStatus: "not_started",
                reconciliationIssues: [],
                reconciliationReviewedAt: null,
                createdAt: "2026-03-20T09:45:00.000Z",
                updatedAt: "2026-03-20T09:45:00.000Z",
              },
            ],
            coverage: {
              approvedUserFlowCount: 1,
              coveredUserFlowCount: 1,
              uncoveredUserFlowIds: [],
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${milestoneProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/milestones/${milestoneId}/design-docs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => designDocsResponse,
        } satisfies Partial<Response>;
      }

      if (path === `/api/milestones/${milestoneId}/design-docs` && method === "PATCH") {
        expect(init?.body).toEqual(JSON.stringify({ markdown: "# Foundations\n\nEdited copy." }));
        designDocsResponse = {
          designDocs: [
            {
              id: "doc-edit-2",
              milestoneId,
              version: 2,
              title: "Foundations design",
              markdown: "# Foundations\n\nEdited copy.",
              source: "ManualEdit",
              isCanonical: true,
              createdAt: "2026-03-20T11:05:00.000Z",
              approval: null,
            },
          ],
        };

        return {
          ok: true,
          status: 200,
          json: async () => designDocsResponse.designDocs[0],
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/milestones", <MilestonesPage />, milestoneProjectId);

    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Milestone Document" }));
    expect(await screen.findByRole("button", { name: "Edit Markdown" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "# Foundations\n\nEdited copy." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save milestone document" }));

    expect(await screen.findByText("Edited copy.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Markdown" })).toBeTruthy();
  });

  it("gates feature builder behind approved user flows and renders the catalogue once unlocked", async () => {
    const featureProjectId = "93939393-9393-4393-8393-939393939393";

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${featureProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: featureProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: featureProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${featureProjectId}/user-flows`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                projectId: featureProjectId,
                title: "Plan delivery milestones",
                userStory: "As a planner, I want a roadmap so delivery can start.",
                entryPoint: "Mission Control",
                endState: "The roadmap is approved.",
                flowSteps: ["Open Mission Control", "Create milestones"],
                coverageTags: ["happy-path", "onboarding"],
                acceptanceCriteria: ["A first increment exists."],
                doneCriteriaRefs: ["DC-1"],
                source: "ManualSave",
                archivedAt: null,
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:00:00.000Z",
              },
            ],
            coverage: { warnings: [], acceptedWarnings: [] },
            approvedAt: method === "GET" ? "2026-03-16T10:01:00.000Z" : null,
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${featureProjectId}/milestones`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            milestones: [
              {
                id: "55555555-5555-4555-8555-555555555555",
                projectId: featureProjectId,
                position: 1,
                title: "Foundations",
                summary: "Establish the first releasable increment.",
                status: "approved",
                linkedUserFlows: [
                  { id: "44444444-4444-4444-8444-444444444444", title: "Plan delivery milestones" },
                ],
                featureCount: 2,
                approvedAt: "2026-03-16T10:02:00.000Z",
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:02:00.000Z",
              },
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                projectId: featureProjectId,
                position: 2,
                title: "Legacy scope",
                summary: "Reapproval is pending, but existing features still need an editor path.",
                status: "draft",
                linkedUserFlows: [
                  { id: "44444444-4444-4444-8444-444444444444", title: "Plan delivery milestones" },
                ],
                featureCount: 1,
                approvedAt: null,
                createdAt: "2026-03-16T10:00:00.000Z",
                updatedAt: "2026-03-16T10:04:00.000Z",
              },
            ],
            coverage: {
              approvedUserFlowCount: 1,
              coveredUserFlowCount: 1,
              uncoveredUserFlowIds: [],
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${featureProjectId}/features`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            features: [
              {
                id: "66666666-6666-4666-8666-666666666666",
                projectId: featureProjectId,
                milestoneId: "55555555-5555-4555-8555-555555555555",
                milestoneTitle: "Foundations",
                featureKey: "F-001",
                kind: "screen",
                priority: "must_have",
                status: "draft",
                headRevision: {
                  id: "77777777-7777-4777-8777-777777777777",
                  featureId: "66666666-6666-4666-8666-666666666666",
                  version: 1,
                  title: "Planning dashboard",
                  summary: "Show roadmap and coverage.",
                  acceptanceCriteria: ["Shows milestones"],
                  source: "ManualSave",
                  createdAt: "2026-03-16T10:03:00.000Z",
                },
                documents: {
                  product: { required: true, state: "accepted" },
                  ux: { required: true, state: "draft" },
                  tech: { required: true, state: "missing" },
                  userDocs: { required: false, state: "missing" },
                  archDocs: { required: false, state: "missing" },
                },
                taskPlanning: {
                  hasTasks: false,
                  taskCount: 0,
                },
                dependencyIds: ["88888888-8888-4888-8888-888888888888"],
                createdAt: "2026-03-16T10:03:00.000Z",
                updatedAt: "2026-03-16T10:03:00.000Z",
                archivedAt: null,
              },
              {
                id: "88888888-8888-4888-8888-888888888888",
                projectId: featureProjectId,
                milestoneId: "55555555-5555-4555-8555-555555555555",
                milestoneTitle: "Foundations",
                featureKey: "F-002",
                kind: "service",
                priority: "should_have",
                status: "approved",
                headRevision: {
                  id: "99999999-9999-4999-8999-999999999999",
                  featureId: "88888888-8888-4888-8888-888888888888",
                  version: 1,
                  title: "Milestone planner service",
                  summary: "Persist roadmap state.",
                  acceptanceCriteria: ["Stores milestones"],
                  source: "ManualSave",
                  createdAt: "2026-03-16T10:03:00.000Z",
                },
                documents: {
                  product: { required: true, state: "accepted" },
                  ux: { required: false, state: "missing" },
                  tech: { required: true, state: "accepted" },
                  userDocs: { required: false, state: "missing" },
                  archDocs: { required: true, state: "draft" },
                },
                taskPlanning: {
                  hasTasks: true,
                  taskCount: 3,
                },
                dependencyIds: [],
                createdAt: "2026-03-16T10:03:00.000Z",
                updatedAt: "2026-03-16T10:03:00.000Z",
                archivedAt: null,
              },
              {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                projectId: featureProjectId,
                milestoneId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                milestoneTitle: "Legacy scope",
                featureKey: "F-003",
                kind: "system",
                priority: "could_have",
                status: "draft",
                headRevision: {
                  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  featureId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                  version: 1,
                  title: "Legacy feature shell",
                  summary: "Keep editor access while the reopened milestone is waiting on reapproval.",
                  acceptanceCriteria: ["Existing features stay visible in the catalogue."],
                  source: "ManualSave",
                  createdAt: "2026-03-16T10:04:00.000Z",
                },
                documents: {
                  product: { required: true, state: "draft" },
                  ux: { required: false, state: "missing" },
                  tech: { required: false, state: "missing" },
                  userDocs: { required: false, state: "missing" },
                  archDocs: { required: false, state: "missing" },
                },
                taskPlanning: {
                  hasTasks: false,
                  taskCount: 0,
                },
                dependencyIds: [],
                createdAt: "2026-03-16T10:04:00.000Z",
                updatedAt: "2026-03-16T10:04:00.000Z",
                archivedAt: null,
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${featureProjectId}/features/graph`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            nodes: [
              {
                featureId: "66666666-6666-4666-8666-666666666666",
                featureKey: "F-001",
                milestoneId: "55555555-5555-4555-8555-555555555555",
                title: "Planning dashboard",
                milestoneTitle: "Foundations",
                kind: "screen",
                priority: "must_have",
                status: "draft",
              },
              {
                featureId: "88888888-8888-4888-8888-888888888888",
                featureKey: "F-002",
                milestoneId: "55555555-5555-4555-8555-555555555555",
                title: "Milestone planner service",
                milestoneTitle: "Foundations",
                kind: "service",
                priority: "should_have",
                status: "approved",
              },
            ],
            edges: [
              {
                featureId: "66666666-6666-4666-8666-666666666666",
                dependsOnFeatureId: "88888888-8888-4888-8888-888888888888",
                type: "depends_on",
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${featureProjectId}/features/rollup`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            totals: { active: 2, archived: 0 },
            byPriority: [
              { key: "must_have", count: 1 },
              { key: "should_have", count: 1 },
            ],
            byStatus: [
              { key: "draft", count: 1 },
              { key: "approved", count: 1 },
            ],
            byKind: [
              { key: "screen", count: 1 },
              { key: "service", count: 1 },
            ],
            byMilestone: [
              {
                milestoneId: "55555555-5555-4555-8555-555555555555",
                milestoneTitle: "Foundations",
                count: 2,
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/features/66666666-6666-4666-8666-666666666666` && method === "PATCH") {
        return { ok: true, status: 200, json: async () => ({}) } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createMemoryRouter(
      [
        { path: "/", element: <div /> },
        { path: "/docs", element: <div /> },
        { path: "/settings", element: <div /> },
        { path: "/projects/:id", element: <div /> },
        { path: "/projects/:id/setup", element: <div /> },
        { path: "/projects/:id/questions", element: <div /> },
        { path: "/projects/:id/one-pager", element: <div /> },
        { path: "/projects/:id/product-spec", element: <div /> },
        { path: "/projects/:id/user-flows", element: <div>User Flows Page</div> },
        { path: "/projects/:id/ux-spec", element: <div /> },
        { path: "/projects/:id/technical-spec", element: <div /> },
        {
          path: "/projects/:id",
          element: <UserFlowsApprovalGate />,
          children: [{ path: "features", element: <FeatureBuilderPage /> }],
        },
      ],
      {
        initialEntries: [`/projects/${featureProjectId}/features`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Feature Builder" })).toBeTruthy();
    expect(screen.getByText("Milestones")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate features" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New feature" })).toBeTruthy();
    expect(screen.getAllByText("Foundations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Legacy scope").length).toBeGreaterThan(0);
    expect(screen.getByText("Reapprove this milestone before generating or creating additional features.")).toBeTruthy();
    expect(screen.getByText("Legacy feature shell")).toBeTruthy();
    expect(screen.getAllByText("Product accepted").length).toBeGreaterThan(0);
    expect(screen.getByText("UX draft")).toBeTruthy();
    expect(screen.getAllByText("Tasks not written").length).toBeGreaterThan(0);
    expect(screen.getByText("Tasks written")).toBeTruthy();
    expect(screen.queryByText("Dependency graph")).toBeNull();
    expect(screen.queryByText("Wire dependency")).toBeNull();
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

    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(screen.queryByText("Unsaved changes pending.")).toBeNull();
    expect(screen.queryByText("Project Questions")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Next: Generate Overview",
      }),
    ).toBeTruthy();
    const summaryField = await screen.findByLabelText("Project Summary");
    expect(screen.getByText("What are you building, and what should it do in plain terms?")).toBeTruthy();
    expect(summaryField.getAttribute("placeholder")).toBeNull();
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
    expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
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

  it("refreshes generated questionnaire answers after the auto-answer job succeeds", async () => {
    const autoAnswerProjectId = "15151515-1515-4515-8515-151515151515";

    vi.stubGlobal("EventSource", MockEventSource);

    let questionnaireRequestCount = 0;
    let autoAnswerSubmitted = false;

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
        questionnaireRequestCount += 1;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: autoAnswerProjectId,
            answers:
              questionnaireRequestCount >= 2
                ? {
                    q1_name_and_description: "Planning workspace",
                    q2_who_is_it_for: "Engineering leads and delivery managers.",
                  }
                : {
                    q1_name_and_description: "Planning workspace",
                  },
            updatedAt:
              questionnaireRequestCount >= 2
                ? "2026-03-16T09:02:30.000Z"
                : "2026-03-16T09:00:00.000Z",
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${autoAnswerProjectId}/questionnaire-answers/auto-answer` &&
        method === "POST"
      ) {
        autoAnswerSubmitted = true;

        return {
          ok: true,
          status: 202,
          json: async () => ({
            id: "5fd58d3b-ffda-4576-b0e6-a8b8267da6ac",
            projectId: autoAnswerProjectId,
            type: "AutoAnswerQuestionnaire",
            status: "queued",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T09:01:00.000Z",
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
            jobs: autoAnswerSubmitted
              ? [
                  {
                    id: "5fd58d3b-ffda-4576-b0e6-a8b8267da6ac",
                    projectId: autoAnswerProjectId,
                    type: "AutoAnswerQuestionnaire",
                    status: "succeeded",
                    inputs: {},
                    outputs: null,
                    error: null,
                    queuedAt: "2026-03-16T09:01:00.000Z",
                    startedAt: "2026-03-16T09:01:10.000Z",
                    completedAt: "2026-03-16T09:02:30.000Z",
                  },
                ]
              : [],
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/questions", <OnePagerQuestionsPage />, autoAnswerProjectId);

    expect(await screen.findByDisplayValue("Planning workspace")).toBeTruthy();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Generate Answers",
      }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, requestInit]) =>
            path === `/api/projects/${autoAnswerProjectId}/questionnaire-answers/auto-answer` &&
            requestInit?.method === "POST",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Engineering leads and delivery managers.")).toBeTruthy();
    }, { timeout: 2_500 });

    expect(questionnaireRequestCount).toBeGreaterThanOrEqual(2);
  });

  it("renders the overview document through the editable markdown surface", async () => {
    const overviewProjectId = "22222222-2222-4222-8222-222222222222";

    vi.stubGlobal("EventSource", MockEventSource);
    let onePager = {
      id: "14ec48cb-6248-4fd0-8df0-58bfa13f8370",
      projectId: overviewProjectId,
      version: 2,
      title: "Overview",
      markdown:
        "# Overview\n\n## Scope\n\nCanonical scope for the planning workspace.\n\n### Defaults\n\nTeam-wide defaults remain explicit.",
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
    expect(screen.getByRole("button", { name: "On This Page" })).toBeTruthy();
    expect(screen.queryByText("Current Overview")).toBeNull();
    expect(await screen.findByRole("button", { name: "Regenerate Overview" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Edit Markdown" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown" }));
    expect(screen.getByTestId("editable-markdown-editor").className).toContain("items-start");
    expect(screen.getByTestId("editable-markdown-editor").className).toContain("min-w-0");
    expect(screen.queryByRole("button", { name: "On This Page" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value:
          "# Overview\n\n## Scope\n\nExpanded canonical scope for the planning workspace.\n\n### Defaults\n\nTeam-wide defaults remain explicit.",
      },
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
    expect(screen.queryByText("Background Jobs")).toBeNull();
  });

  it("refreshes the overview after generation succeeds without a page reload", async () => {
    const overviewProjectId = "23232323-2323-4232-8232-232323232323";

    vi.stubGlobal("EventSource", MockEventSource);

    let onePager: {
      id: string;
      projectId: string;
      version: number;
      title: string;
      markdown: string;
      source: string;
      isCanonical: boolean;
      approvedAt: string | null;
      createdAt: string;
    } | null = null;
    let versions: Array<{
      id: string;
      projectId: string;
      version: number;
      title: string;
      markdown: string;
      source: string;
      isCanonical: boolean;
      approvedAt: string | null;
      createdAt: string;
    }> = [];
    let generateSubmitted = false;

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

      if (path === `/api/projects/${overviewProjectId}/one-pager/versions` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/one-pager` && method === "POST") {
        generateSubmitted = true;
        onePager = {
          id: "generated-overview-id",
          projectId: overviewProjectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview\n\nGenerated without refresh.",
          source: "generated",
          isCanonical: true,
          approvedAt: null,
          createdAt: "2026-03-16T09:10:00.000Z",
        };
        versions = [onePager];

        return {
          ok: true,
          status: 202,
          json: async () => ({
            id: "overview-job-id",
            projectId: overviewProjectId,
            type: "GenerateProjectOverview",
            status: "queued",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T09:06:00.000Z",
            startedAt: null,
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${overviewProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: generateSubmitted
              ? [
                  {
                    id: "overview-job-id",
                    projectId: overviewProjectId,
                    type: "GenerateProjectOverview",
                    status: "succeeded",
                    inputs: {},
                    outputs: null,
                    error: null,
                    queuedAt: "2026-03-16T09:06:00.000Z",
                    startedAt: "2026-03-16T09:06:10.000Z",
                    completedAt: "2026-03-16T09:10:00.000Z",
                  },
                ]
              : [],
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

    fireEvent.click(await screen.findByRole("button", { name: "Generate Overview" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, requestInit]) =>
            path === `/api/projects/${overviewProjectId}/one-pager` &&
            requestInit?.method === "POST",
        ),
      ).toBe(true);
    });

    expect(
      await screen.findByText("Generated without refresh.", {}, { timeout: 2_500 }),
    ).toBeTruthy();
    expect(screen.queryByText("The overview is being prepared. Stay on this page to review it when the job finishes.")).toBeNull();
  });

  it("keeps questions header status text free of timestamps", async () => {
    const completedProjectId = "14141414-1414-4414-8414-141414141414";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${completedProjectId}`]: {
        id: completedProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY_PARTIAL",
        ownerUserId: completedProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${completedProjectId}/setup-status`]: {
        repoConnected: true,
        llmVerified: true,
        sandboxVerified: true,
        checks: [],
      },
      [`/api/projects/${completedProjectId}/questionnaire-answers`]: {
        projectId: completedProjectId,
        answers: {
          q1_name_and_description: "Planning workspace",
        },
        updatedAt: "2026-03-16T09:00:00.000Z",
        completedAt: "2026-03-16T09:05:00.000Z",
      },
      [`/api/projects/${completedProjectId}/jobs`]: {
        jobs: [],
      },
    });

    const { getByTestId } = renderRoute(
      "/projects/:id/questions",
      <OnePagerQuestionsPage />,
      completedProjectId,
    );

    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(screen.queryByText(/Mar 16, 2026/i)).toBeNull();
    expect(screen.queryByText(/^complete /i)).toBeNull();
    expect(
      within(getByTestId("questionnaire-header-actions")).getByText("Saved"),
    ).toBeTruthy();
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

  it("refreshes overview content when an SSE job completion event arrives", async () => {
    const overviewProjectId = "21212121-2121-4121-8121-212121212121";
    let onePager = null as
      | {
          approvedAt: string | null;
          createdAt: string;
          id: string;
          isCanonical: boolean;
          markdown: string;
          projectId: string;
          source: string;
          title: string;
          version: number;
        }
      | null;
    let versions: Array<{
      approvedAt: string | null;
      createdAt: string;
      id: string;
      isCanonical: boolean;
      markdown: string;
      projectId: string;
      source: string;
      title: string;
      version: number;
    }> = [];
    let jobs: Job[] = [
      {
        id: "overview-job-id",
        projectId: overviewProjectId,
        type: "GenerateProjectOverview",
        status: "running",
        inputs: {},
        outputs: null,
        error: null,
        queuedAt: "2026-03-16T09:00:00.000Z",
        startedAt: "2026-03-16T09:01:00.000Z",
        completedAt: null,
      },
    ];

    vi.stubGlobal("EventSource", MockEventSource);
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
          json: async () => ({ jobs }),
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

    expect(await screen.findByText("The overview is being prepared. Stay on this page to review it when the job finishes.")).toBeTruthy();

    onePager = {
      id: "new-overview-id",
      projectId: overviewProjectId,
      version: 1,
      title: "Overview",
      markdown: "# Overview\n\nGenerated after SSE.",
      source: "generated",
      isCanonical: true,
      approvedAt: null,
      createdAt: "2026-03-16T09:10:00.000Z",
    };
    versions = [onePager];
    jobs = [
      {
        ...jobs[0],
        status: "succeeded",
        completedAt: "2026-03-16T09:10:00.000Z",
      },
    ];

    MockEventSource.emit("job:updated", {
      jobId: "overview-job-id",
      projectId: overviewProjectId,
      status: "succeeded",
    });

    expect(await screen.findByText("Generated after SSE.")).toBeTruthy();
    expect(screen.queryByText("The overview is being prepared. Stay on this page to review it when the job finishes.")).toBeNull();
  });

  it("renders the Product Spec page through the editable markdown surface", async () => {
    const productSpecProjectId = "30303030-3030-4030-8030-303030303030";

    vi.stubGlobal("EventSource", MockEventSource);
    let productSpec = {
      id: "14ec48cb-6248-4fd0-8df0-58bfa13f8371",
      projectId: productSpecProjectId,
      version: 2,
      title: "Product Spec",
      markdown:
        "# Product Spec\n\n## Scope\n\nCanonical specification.\n\n### Risks\n\nCapture the principal delivery risks.",
      source: "GenerateProductSpec",
      isCanonical: true,
      approvedAt: null,
      createdAt: "2026-03-16T09:10:00.000Z",
    };
    let versions = [productSpec];
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

      if (path === `/api/projects/${productSpecProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: productSpecProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY_PARTIAL",
            ownerUserId: productSpecProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/product-spec` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ productSpec }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/product-spec` && method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as { markdown: string };
        productSpec = {
          ...productSpec,
          id: "a9dc6076-20da-43b0-84fb-e8cac2409319",
          version: 3,
          markdown: payload.markdown,
          source: "ManualEdit",
          approvedAt: null,
          createdAt: "2026-03-16T09:12:00.000Z",
        };
        versions = [productSpec, ...versions.map((version) => ({ ...version, isCanonical: false }))];

        return {
          ok: true,
          status: 200,
          json: async () => productSpec,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/product-spec/versions` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [
              {
                id: "4c57d789-a423-46e0-8b36-c09f9e9d8ad9",
                projectId: productSpecProjectId,
                type: "GenerateProductSpec",
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

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/product-spec", <ProductSpecPage />, productSpecProjectId);

    expect(await screen.findByRole("heading", { name: "Generated Product Spec" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "On This Page" })).toBeTruthy();
    expect(screen.queryByText("Current Product Spec")).toBeNull();
    expect(await screen.findByRole("button", { name: "Regenerate Product Spec" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Edit Markdown" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown" }));
    expect(screen.getByTestId("editable-markdown-editor").className).toContain("min-w-0");
    expect(screen.queryByRole("button", { name: "On This Page" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value:
          "# Product Spec\n\n## Scope\n\nExpanded canonical specification.\n\n### Risks\n\nCapture the principal delivery risks.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Product Spec" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === `/api/projects/${productSpecProjectId}/product-spec` &&
            init?.method === "PATCH",
        ),
      ).toBe(true);
    });

    expect(await screen.findByText("Expanded canonical specification.")).toBeTruthy();
    expect(await screen.findByText("Version 3 (canonical)")).toBeTruthy();
  });

  it("refreshes the Product Spec after generation succeeds without a page reload", async () => {
    const productSpecProjectId = "31313131-3131-4313-8313-313131313131";

    vi.stubGlobal("EventSource", MockEventSource);

    let productSpec: {
      id: string;
      projectId: string;
      version: number;
      title: string;
      markdown: string;
      source: string;
      isCanonical: boolean;
      approvedAt: string | null;
      createdAt: string;
    } | null = null;
    let versions: Array<{
      id: string;
      projectId: string;
      version: number;
      title: string;
      markdown: string;
      source: string;
      isCanonical: boolean;
      approvedAt: string | null;
      createdAt: string;
    }> = [];
    let generateSubmitted = false;

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

      if (path === `/api/projects/${productSpecProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: productSpecProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: productSpecProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/product-spec` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ productSpec }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/product-spec/versions` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/product-spec` && method === "POST") {
        generateSubmitted = true;
        productSpec = {
          id: "generated-product-spec-id",
          projectId: productSpecProjectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec\n\nGenerated without refresh.",
          source: "GenerateProductSpec",
          isCanonical: true,
          approvedAt: null,
          createdAt: "2026-03-16T09:10:00.000Z",
        };
        versions = [productSpec];

        return {
          ok: true,
          status: 202,
          json: async () => ({
            id: "product-spec-job-id",
            projectId: productSpecProjectId,
            type: "GenerateProductSpec",
            status: "queued",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T09:06:00.000Z",
            startedAt: null,
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${productSpecProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: generateSubmitted
              ? [
                  {
                    id: "product-spec-job-id",
                    projectId: productSpecProjectId,
                    type: "GenerateProductSpec",
                    status: "succeeded",
                    inputs: {},
                    outputs: null,
                    error: null,
                    queuedAt: "2026-03-16T09:06:00.000Z",
                    startedAt: "2026-03-16T09:06:10.000Z",
                    completedAt: "2026-03-16T09:10:00.000Z",
                  },
                ]
              : [],
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/product-spec", <ProductSpecPage />, productSpecProjectId);

    fireEvent.click(await screen.findByRole("button", { name: "Generate Product Spec" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, requestInit]) =>
            path === `/api/projects/${productSpecProjectId}/product-spec` &&
            requestInit?.method === "POST",
        ),
      ).toBe(true);
    });

    expect(
      await screen.findByText("Generated without refresh.", {}, { timeout: 2_500 }),
    ).toBeTruthy();
    expect(
      screen.queryByText("The Product Spec is being prepared. Stay on this page to review it when the job finishes."),
    ).toBeNull();
  });

  it("loads the Product Spec page without an error when the overview is approved but no Product Spec exists yet", async () => {
    const productSpecProjectId = "60606060-6060-4060-8060-606060606060";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${productSpecProjectId}`]: {
        id: productSpecProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: productSpecProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${productSpecProjectId}/product-spec`]: {
        productSpec: null,
      },
      [`/api/projects/${productSpecProjectId}/product-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${productSpecProjectId}/jobs`]: {
        jobs: [],
      },
    });

    renderRoute("/projects/:id/product-spec", <ProductSpecPage />, productSpecProjectId);

    expect(await screen.findByRole("heading", { name: "Generated Product Spec" })).toBeTruthy();
    expect(screen.getByText("No Product Spec has been generated yet. Generate it from this screen after the overview is approved.")).toBeTruthy();
    expect(screen.queryByText("An unexpected error occurred.")).toBeNull();
  });

  it("surfaces product spec job failures with shared guidance", async () => {
    const productSpecProjectId = "61616161-6161-4161-8161-616161616161";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${productSpecProjectId}`]: {
        id: productSpecProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: productSpecProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${productSpecProjectId}/product-spec`]: {
        productSpec: null,
      },
      [`/api/projects/${productSpecProjectId}/product-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${productSpecProjectId}/jobs`]: {
        jobs: [
          {
            id: "job-product-spec-failed",
            projectId: productSpecProjectId,
            type: "GenerateProductSpec",
            status: "failed",
            inputs: {},
            outputs: null,
            error: {
              message: "The configured model timed out before returning a Product Spec draft.",
            },
            queuedAt: "2026-03-20T10:01:00.000Z",
            startedAt: "2026-03-20T10:01:30.000Z",
            completedAt: "2026-03-20T10:02:00.000Z",
          },
        ],
      },
    });

    renderRoute("/projects/:id/product-spec", <ProductSpecPage />, productSpecProjectId);

    expect(await screen.findByRole("heading", { name: "Generated Product Spec" })).toBeTruthy();
    expect(await screen.findByText("Product Spec generation failed.")).toBeTruthy();
    expect(
      screen.getByText("The configured model timed out before returning a Product Spec draft."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Review the failure details, adjust the source inputs if needed, then retry Product Spec generation.",
      ),
    ).toBeTruthy();
  });

  it("hides a stale product spec failure after a newer successful job", async () => {
    const productSpecProjectId = "62626262-6262-4262-8262-626262626262";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${productSpecProjectId}`]: {
        id: productSpecProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: productSpecProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${productSpecProjectId}/product-spec`]: {
        productSpec: {
          id: "prod-spec-1",
          projectId: productSpecProjectId,
          markdown: "# Product Spec",
          approvedAt: null,
          createdAt: "2026-03-20T10:05:00.000Z",
          updatedAt: "2026-03-20T10:05:00.000Z",
        },
      },
      [`/api/projects/${productSpecProjectId}/product-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${productSpecProjectId}/jobs`]: {
        jobs: [
          {
            id: "job-product-spec-failed",
            projectId: productSpecProjectId,
            type: "GenerateProductSpec",
            status: "failed",
            inputs: {},
            outputs: null,
            error: {
              message: "The configured model timed out before returning a Product Spec draft.",
            },
            queuedAt: "2026-03-20T10:01:00.000Z",
            startedAt: "2026-03-20T10:01:30.000Z",
            completedAt: "2026-03-20T10:02:00.000Z",
          },
          {
            id: "job-product-spec-succeeded",
            projectId: productSpecProjectId,
            type: "GenerateProductSpec",
            status: "succeeded",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-20T10:03:00.000Z",
            startedAt: "2026-03-20T10:03:30.000Z",
            completedAt: "2026-03-20T10:05:00.000Z",
          },
        ],
      },
    });

    renderRoute("/projects/:id/product-spec", <ProductSpecPage />, productSpecProjectId);

    expect(await screen.findByRole("heading", { name: "Generated Product Spec" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Product Spec generation failed.")).toBeNull();
    });
  });

  it("renders User Flows generation and approval actions", async () => {
    const userFlowsProjectId = "70707070-7070-4070-8070-707070707070";
    const generateJobId = "d3057770-eca1-417a-a1c6-c00bb83a47d1";
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

      if (path === `/api/projects/${userFlowsProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: userFlowsProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: userFlowsProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/user-flows` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userFlows: [],
            coverage: {
              warnings: [],
              acceptedWarnings: [],
            },
            approvedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/user-flows/generate` && method === "POST") {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            id: generateJobId,
            projectId: userFlowsProjectId,
            type: "GenerateUseCases",
            status: "queued",
            inputs: {},
            outputs: null,
            error: null,
            queuedAt: "2026-03-16T10:00:00.000Z",
            startedAt: null,
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/user-flows", <UserFlowsPage />, userFlowsProjectId);

    expect(await screen.findByRole("heading", { name: "User Flows" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add User Flow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Flows" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve User Flows" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve User Flows" }).className).toContain(
      "bg-accent",
    );
    expect(screen.queryByRole("button", { name: "Save User Flow" })).toBeNull();
    expect(screen.queryByText("Coverage summary")).toBeNull();
    expect(screen.queryByRole("button", { name: "Deduplicate" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Generate Flows" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === `/api/projects/${userFlowsProjectId}/user-flows/generate` &&
            init?.method === "POST",
        ),
      ).toBe(true);
    });
  });

  it("reveals the add user flow panel, submits a manual flow, and closes it on success", async () => {
    const userFlowsProjectId = "72727272-7272-4272-8272-727272727272";
    let userFlowsResponse: UseCaseListResponse = {
      userFlows: [],
      coverage: {
        warnings: [],
        acceptedWarnings: [],
      },
      approvedAt: null,
    };
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

      if (path === `/api/projects/${userFlowsProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: userFlowsProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: userFlowsProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/user-flows` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => userFlowsResponse,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/user-flows` && method === "POST") {
        const payload = JSON.parse(String(init?.body)) as {
          acceptanceCriteria: string[];
          coverageTags: string[];
          doneCriteriaRefs: string[];
          endState: string;
          entryPoint: string;
          flowSteps: string[];
          source: string;
          title: string;
          userStory: string;
        };

        expect(payload).toEqual({
          acceptanceCriteria: ["Project appears in Mission Control."],
          coverageTags: ["happy-path", "onboarding"],
          doneCriteriaRefs: ["manual"],
          endState: "The new project is visible in Mission Control.",
          entryPoint: "Projects home",
          flowSteps: ["Click new project", "Enter details", "Create project"],
          source: "manual",
          title: "Create first project",
          userStory: "As a new user, I want to create a project so I can begin planning.",
        });

        userFlowsResponse = {
          userFlows: [
            {
              id: "flow-create-id",
              projectId: userFlowsProjectId,
              title: payload.title,
              userStory: payload.userStory,
              entryPoint: payload.entryPoint,
              endState: payload.endState,
              flowSteps: payload.flowSteps,
              coverageTags: payload.coverageTags,
              acceptanceCriteria: payload.acceptanceCriteria,
              doneCriteriaRefs: payload.doneCriteriaRefs,
              source: payload.source,
              archivedAt: null,
              createdAt: "2026-03-16T10:00:00.000Z",
              updatedAt: "2026-03-16T10:00:00.000Z",
            },
          ],
          coverage: {
            warnings: [],
            acceptedWarnings: [],
          },
          approvedAt: null,
        };

        return {
          ok: true,
          status: 201,
          json: async () => userFlowsResponse.userFlows[0],
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/user-flows", <UserFlowsPage />, userFlowsProjectId);

    expect(await screen.findByRole("heading", { name: "User Flows" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save User Flow" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add User Flow" }));

    expect(await screen.findByRole("button", { name: "Save User Flow" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Create first project" },
    });
    fireEvent.change(screen.getByLabelText("User story"), {
      target: {
        value: "As a new user, I want to create a project so I can begin planning.",
      },
    });
    fireEvent.change(screen.getByLabelText("Entry point"), {
      target: { value: "Projects home" },
    });
    fireEvent.change(screen.getByLabelText("End state"), {
      target: { value: "The new project is visible in Mission Control." },
    });
    fireEvent.change(screen.getByLabelText("Flow steps"), {
      target: { value: "Click new project\nEnter details\nCreate project" },
    });
    fireEvent.change(screen.getByLabelText("Coverage tags"), {
      target: { value: "happy-path, onboarding" },
    });
    fireEvent.change(screen.getByLabelText("Acceptance criteria"), {
      target: { value: "Project appears in Mission Control." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save User Flow" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === `/api/projects/${userFlowsProjectId}/user-flows` && init?.method === "POST",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save User Flow" })).toBeNull();
    });
    expect(await screen.findByText("Create first project")).toBeTruthy();
  });

  it("shows the generate flows AI button as active only for running generation jobs", async () => {
    const userFlowsProjectId = "71717171-7171-4171-8171-717171717171";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${userFlowsProjectId}`]: {
        id: userFlowsProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: userFlowsProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${userFlowsProjectId}/user-flows`]: {
        userFlows: [],
        coverage: {
          warnings: [],
          acceptedWarnings: [],
        },
        approvedAt: null,
      },
      [`/api/projects/${userFlowsProjectId}/jobs`]: {
        jobs: [
          {
            id: "d3057770-eca1-417a-a1c6-c00bb83a47d3",
            projectId: userFlowsProjectId,
            type: "GenerateUseCases",
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

    renderRoute("/projects/:id/user-flows", <UserFlowsPage />, userFlowsProjectId);

    expect(
      (await screen.findByRole("button", { name: "Generating Flows" })) as HTMLButtonElement,
    ).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Deduplicate" })).toBeNull();
  });

  it("edits an existing user flow inline and preserves metadata", async () => {
    const userFlowsProjectId = "73737373-7373-4373-8373-737373737373";
    let userFlowsResponse: UseCaseListResponse = {
      userFlows: [
        {
          id: "flow-edit-id",
          projectId: userFlowsProjectId,
          title: "Invite a teammate",
          userStory: "As an admin, I want to invite a teammate so collaboration can start.",
          entryPoint: "Workspace members panel",
          endState: "The teammate receives an invitation email.",
          flowSteps: ["Open members", "Enter teammate email", "Send invite"],
          coverageTags: ["happy-path", "onboarding"],
          acceptanceCriteria: ["Invitation can be sent successfully."],
          doneCriteriaRefs: ["spec-1"],
          source: "generated",
          archivedAt: null,
          createdAt: "2026-03-16T10:00:00.000Z",
          updatedAt: "2026-03-16T10:00:00.000Z",
        },
      ],
      coverage: {
        warnings: [],
        acceptedWarnings: [],
      },
      approvedAt: "2026-03-16T10:05:00.000Z",
    };
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

      if (path === `/api/projects/${userFlowsProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: userFlowsProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: userFlowsProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/user-flows` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => userFlowsResponse,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [],
          }),
        } satisfies Partial<Response>;
      }

      if (path === "/api/user-flows/flow-edit-id" && method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as {
          acceptanceCriteria: string[];
          coverageTags: string[];
          doneCriteriaRefs: string[];
          endState: string;
          entryPoint: string;
          flowSteps: string[];
          source: string;
          title: string;
          userStory: string;
        };

        expect(payload.doneCriteriaRefs).toEqual(["spec-1"]);
        expect(payload.source).toBe("generated");

        userFlowsResponse = {
          userFlows: [
            {
              ...userFlowsResponse.userFlows[0],
              title: payload.title,
              userStory: payload.userStory,
              entryPoint: payload.entryPoint,
              endState: payload.endState,
              flowSteps: payload.flowSteps,
              coverageTags: payload.coverageTags,
              acceptanceCriteria: payload.acceptanceCriteria,
              updatedAt: "2026-03-16T10:10:00.000Z",
            },
          ],
          coverage: {
            warnings: [],
            acceptedWarnings: [],
          },
          approvedAt: null,
        };

        return {
          ok: true,
          status: 200,
          json: async () => userFlowsResponse.userFlows[0],
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/user-flows", <UserFlowsPage />, userFlowsProjectId);

    expect(await screen.findByText("Invite a teammate")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" }).parentElement?.className).toContain(
      "flex-col",
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Invite and assign a teammate" },
    });
    fireEvent.change(screen.getByLabelText("Flow steps"), {
      target: { value: "Open members\nEnter teammate email\nAssign role\nSend invite" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) => path === "/api/user-flows/flow-edit-id" && init?.method === "PATCH",
        ),
      ).toBe(true);
    });

    expect(await screen.findByText("Invite and assign a teammate")).toBeTruthy();
    expect(await screen.findByText("Assign role")).toBeTruthy();
    expect((await screen.findAllByText("Pending review")).length).toBeGreaterThan(0);
  });

  it("archives a user flow from the active catalogue", async () => {
    const userFlowsProjectId = "74747474-7474-4474-8474-747474747474";
    let userFlowsResponse: UseCaseListResponse = {
      userFlows: [
        {
          id: "flow-archive-id",
          projectId: userFlowsProjectId,
          title: "Create first project",
          userStory: "As a new user, I want to create a project so I can begin planning.",
          entryPoint: "Projects home",
          endState: "The new project appears in Mission Control.",
          flowSteps: ["Click new project", "Enter details", "Create project"],
          coverageTags: ["happy-path", "onboarding"],
          acceptanceCriteria: ["Project is created."],
          doneCriteriaRefs: ["manual"],
          source: "manual",
          archivedAt: null,
          createdAt: "2026-03-16T10:00:00.000Z",
          updatedAt: "2026-03-16T10:00:00.000Z",
        },
      ],
      coverage: {
        warnings: [],
        acceptedWarnings: [],
      },
      approvedAt: "2026-03-16T10:05:00.000Z",
    };
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

      if (path === `/api/projects/${userFlowsProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: userFlowsProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: userFlowsProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/user-flows` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => userFlowsResponse,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${userFlowsProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [],
          }),
        } satisfies Partial<Response>;
      }

      if (path === "/api/user-flows/flow-archive-id" && method === "DELETE") {
        userFlowsResponse = {
          userFlows: [],
          coverage: {
            warnings: ["Add at least one active user flow."],
            acceptedWarnings: [],
          },
          approvedAt: null,
        };

        return {
          ok: true,
          status: 204,
          json: async () => undefined,
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });

    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/user-flows", <UserFlowsPage />, userFlowsProjectId);

    expect(await screen.findByText("Create first project")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === "/api/user-flows/flow-archive-id" && init?.method === "DELETE",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.queryByText("Create first project")).toBeNull();
    });
    expect(await screen.findByText("0 items")).toBeTruthy();
    expect((await screen.findAllByText("Pending review")).length).toBeGreaterThan(0);
  });

  it("redirects Product Spec access back to overview until the overview is approved", async () => {
    const gatedProjectId = "40404040-4040-4040-8040-404040404040";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${gatedProjectId}`]: {
        id: gatedProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY_PARTIAL",
        ownerUserId: gatedProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${gatedProjectId}/setup-status`]: {
        repoConnected: true,
        llmVerified: true,
        sandboxVerified: true,
        checks: [],
      },
      [`/api/projects/${gatedProjectId}/questionnaire-answers`]: {
        projectId: gatedProjectId,
        answers: {},
        updatedAt: "2026-03-16T09:00:00.000Z",
        completedAt: "2026-03-16T09:05:00.000Z",
      },
      [`/api/projects/${gatedProjectId}/one-pager`]: {
        onePager: {
          id: "one-pager-id",
          projectId: gatedProjectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview",
          source: "GenerateProjectOverview",
          isCanonical: true,
          approvedAt: null,
          createdAt: "2026-03-16T09:00:00.000Z",
        },
      },
      [`/api/projects/${gatedProjectId}/one-pager/versions`]: {
        versions: [],
      },
      [`/api/projects/${gatedProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/projects/${gatedProjectId}/phase-gates`]: {
        phases: [
          {
            phase: "Overview Document",
            passed: false,
            items: [
              { key: "questionnaire", label: "Questionnaire complete", passed: true },
              { key: "overview", label: "Overview approved", passed: false },
            ],
          },
        ],
      },
    });

    const router = createMemoryRouter(
      [
        { path: "/projects/:id", element: <div /> },
        { path: "/projects/:id/setup", element: <div /> },
        { path: "/projects/:id/questions", element: <div /> },
        { path: "/projects/:id/one-pager", element: <OnePagerOverviewPage /> },
        {
          element: <OverviewApprovalGate />,
          children: [{ path: "/projects/:id/product-spec", element: <ProductSpecPage /> }],
        },
      ],
      {
        initialEntries: [`/projects/${gatedProjectId}/product-spec`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Generated Overview" })).toBeTruthy();
    expect(
      screen.getByText(/Approve the overview on this page to continue to the next stage\./),
    ).toBeTruthy();
    expect(screen.getByText("/projects/40404040-4040-4040-8040-404040404040/product-spec")).toBeTruthy();
  });

  it("redirects UX Spec access back to Product Spec until the Product Spec is approved", async () => {
    const gatedProjectId = "50505050-5050-4050-8050-505050505050";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${gatedProjectId}`]: {
        id: gatedProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: gatedProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${gatedProjectId}/one-pager`]: {
        onePager: {
          id: "one-pager-id",
          projectId: gatedProjectId,
          version: 1,
          title: "Overview",
          markdown: "# Overview",
          source: "GenerateProjectOverview",
          isCanonical: true,
          approvedAt: "2026-03-16T09:00:00.000Z",
          createdAt: "2026-03-16T09:00:00.000Z",
        },
      },
      [`/api/projects/${gatedProjectId}/product-spec`]: {
        productSpec: {
          id: "product-spec-id",
          projectId: gatedProjectId,
          version: 1,
          title: "Product Spec",
          markdown: "# Product Spec",
          source: "GenerateProductSpec",
          isCanonical: true,
          approvedAt: null,
          createdAt: "2026-03-16T09:30:00.000Z",
        },
      },
      [`/api/projects/${gatedProjectId}/product-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${gatedProjectId}/jobs`]: {
        jobs: [],
      },
    });

    const router = createMemoryRouter(
      [
        { path: "/projects/:id", element: <div /> },
        { path: "/projects/:id/setup", element: <div /> },
        { path: "/projects/:id/questions", element: <div /> },
        { path: "/projects/:id/one-pager", element: <div>Overview page</div> },
        { path: "/projects/:id/product-spec", element: <ProductSpecPage /> },
        {
          element: <ProductSpecApprovalGate />,
          children: [{ path: "/projects/:id/ux-spec", element: <div>UX Spec page</div> }],
        },
      ],
      {
        initialEntries: [`/projects/${gatedProjectId}/ux-spec`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Generated Product Spec" })).toBeTruthy();
    expect(
      screen.getByText(/Approve the Product Spec on this page to continue to UX Spec\./),
    ).toBeTruthy();
    expect(screen.getByText("/projects/50505050-5050-4050-8050-505050505050/ux-spec")).toBeTruthy();
  });

  it("redirects User Flows access back to Technical Spec until the Technical Spec is approved", async () => {
    const gatedProjectId = "51515151-5151-4151-8151-515151515151";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${gatedProjectId}`]: {
        id: gatedProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: gatedProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${gatedProjectId}/technical-spec/decision-tiles`]: {
        cards: [],
      },
      [`/api/projects/${gatedProjectId}/technical-spec`]: {
        blueprint: {
          id: "technical-spec-id",
          projectId: gatedProjectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec",
          source: "GenerateProjectBlueprint",
          isCanonical: true,
          createdAt: "2026-03-16T09:30:00.000Z",
        },
      },
      [`/api/projects/${gatedProjectId}/technical-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${gatedProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/projects/${gatedProjectId}/artifacts/blueprint_tech/technical-spec-id/approval`]: {
        artifactType: "blueprint_tech",
        artifactId: "technical-spec-id",
        approval: null,
      },
    });

    const router = createMemoryRouter(
      [
        { path: "/projects/:id", element: <div /> },
        { path: "/projects/:id/setup", element: <div /> },
        { path: "/projects/:id/questions", element: <div /> },
        { path: "/projects/:id/one-pager", element: <div>Overview page</div> },
        { path: "/projects/:id/product-spec", element: <div>Product Spec page</div> },
        { path: "/projects/:id/ux-spec", element: <div>UX Spec page</div> },
        { path: "/projects/:id/technical-spec", element: <TechnicalSpecPage /> },
        {
          element: <TechnicalSpecApprovalGate />,
          children: [{ path: "/projects/:id/user-flows", element: <div>User Flows page</div> }],
        },
      ],
      {
        initialEntries: [`/projects/${gatedProjectId}/user-flows`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect((await screen.findAllByRole("heading", { name: "Technical Spec" })).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Approve the Technical Spec on this page to continue to User Flows\./),
    ).toBeTruthy();
    expect(screen.getByText("/projects/51515151-5151-4151-8151-515151515151/user-flows")).toBeTruthy();
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
        { path: "/projects/:id/product-spec", element: <div /> },
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
        /Complete setup to unlock Questions, Overview, Product Spec, User Flows, and Import\. You were redirected from/,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Questions" })).toBeNull();
  });

  it("keeps UX Spec generation locked until UX decisions are accepted", async () => {
    const specProjectId = "70707070-7070-4070-8070-707070707070";

    vi.stubGlobal("EventSource", MockEventSource);
    const generateKinds: string[] = [];
    let cards: DecisionCard[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        projectId: specProjectId,
        kind: "ux",
        key: "primary-navigation",
        category: "navigation",
        title: "Primary navigation",
        prompt: "Choose the primary navigation model.",
        recommendation: {
          id: "sidebar",
          label: "Sidebar",
          description: "Keep major areas always visible.",
        },
        alternatives: [
          {
            id: "top-nav",
            label: "Top nav",
            description: "Use a horizontal top navigation.",
          },
          {
            id: "hub-pages",
            label: "Hub pages",
            description: "Drive navigation through contextual hub pages.",
          },
        ],
        selectedOptionId: null,
        customSelection: null,
        acceptedAt: null,
        createdAt: "2026-03-18T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
      },
    ];
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

      if (path === `/api/projects/${specProjectId}` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: specProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: specProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec/decision-tiles` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ cards }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec/decision-tiles` && method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as {
          cards: Array<{ customSelection?: string | null; id: string; selectedOptionId?: string | null }>;
        };

        cards = cards.map((card) => {
          const update = payload.cards.find((candidate) => candidate.id === card.id);

          if (!update) {
            return card;
          }

          return {
            ...card,
            customSelection: update.customSelection ?? null,
            selectedOptionId: update.customSelection ? null : (update.selectedOptionId ?? null),
            acceptedAt: null,
            updatedAt: "2026-03-19T00:00:00.000Z",
          };
        });

        return {
          ok: true,
          status: 200,
          json: async () => ({ cards }),
        } satisfies Partial<Response>;
      }

      if (
        path === `/api/projects/${specProjectId}/ux-spec/decision-tiles/accept` &&
        method === "POST"
      ) {
        cards = cards.map((card) => ({
          ...card,
          acceptedAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:01:00.000Z",
        }));

        return {
          ok: true,
          status: 200,
          json: async () => ({ cards }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ blueprint: null }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec/versions` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/phase-gates` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            phases: [
              { phase: "Project Setup", passed: true, items: [] },
              { phase: "Overview Document", passed: true, items: [] },
              { phase: "Product Spec", passed: true, items: [] },
              { phase: "User Flows", passed: true, items: [] },
              { phase: "UX Spec", passed: false, items: [] },
              { phase: "Technical Spec", passed: false, items: [] },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/jobs` && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec` && method === "POST") {
        generateKinds.push("ux");

        return {
          ok: true,
          status: 202,
          json: async () => ({
            id: "job-generate-ux",
            projectId: specProjectId,
            type: "GenerateProjectBlueprint",
            status: "queued",
            inputs: { kind: "ux" },
            outputs: null,
            error: null,
            queuedAt: "2026-03-19T00:00:00.000Z",
            startedAt: null,
            completedAt: null,
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/projects/:id/ux-spec", <UxSpecPage />, specProjectId);

    expect((await screen.findAllByRole("heading", { name: "UX Spec" })).length).toBeGreaterThan(0);
    expect(await screen.findByText("Primary navigation")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate UX Spec" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Choose Option" })[0]!);

    expect(await screen.findByRole("button", { name: "Edit Decision" })).toBeTruthy();
    expect(screen.getByText("option selected")).toBeTruthy();

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Accept UX Decisions" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Accept UX Decisions" }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Generate UX Spec" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate UX Spec" }));

    await waitFor(() => {
      expect(generateKinds).toEqual(["ux"]);
    });
  });

  it("surfaces blueprint job failures with actionable guidance on the spec page", async () => {
    const specProjectId = "90909090-9090-4090-8090-909090909090";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${specProjectId}`]: {
        id: specProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: specProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${specProjectId}/ux-spec/decision-tiles`]: {
        cards: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            projectId: specProjectId,
            kind: "ux",
            key: "spending-data-strategy",
            category: "data",
            title: "Spending data strategy",
            prompt: "Choose how spending data is collected.",
            recommendation: {
              id: "open-banking",
              label: "Open banking",
              description: "Connect transaction accounts directly.",
            },
            alternatives: [
              {
                id: "manual-entry",
                label: "Manual entry",
                description: "Users enter spending data manually.",
              },
            ],
            selectedOptionId: null,
            customSelection: "No open banking",
            acceptedAt: "2026-03-20T10:00:00.000Z",
            createdAt: "2026-03-20T09:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z",
          },
        ],
      },
      [`/api/projects/${specProjectId}/ux-spec`]: {
        blueprint: null,
      },
      [`/api/projects/${specProjectId}/ux-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${specProjectId}/phase-gates`]: {
        phases: [
          { phase: "Project Setup", passed: true, items: [] },
          { phase: "Overview Document", passed: true, items: [] },
          { phase: "Product Spec", passed: true, items: [] },
          { phase: "User Flows", passed: true, items: [] },
          { phase: "UX Spec", passed: false, items: [] },
          { phase: "Technical Spec", passed: false, items: [] },
        ],
      },
      [`/api/projects/${specProjectId}/jobs`]: {
        jobs: [
          {
            id: "job-blueprint-failed",
            projectId: specProjectId,
            type: "GenerateProjectBlueprint",
            status: "failed",
            inputs: { kind: "ux" },
            outputs: null,
            error: {
              message:
                "ValidateDecisionConsistency found conflicts: The selected spending-data-strategy conflicts with the approved Product Spec.",
            },
            queuedAt: "2026-03-20T10:01:00.000Z",
            startedAt: "2026-03-20T10:01:30.000Z",
            completedAt: "2026-03-20T10:02:00.000Z",
          },
        ],
      },
    });

    renderRoute("/projects/:id/ux-spec", <UxSpecPage />, specProjectId);

    expect((await screen.findAllByRole("heading", { name: "UX Spec" })).length).toBeGreaterThan(0);
    expect(await screen.findByText("UX Spec generation failed.")).toBeTruthy();
    expect(
      screen.getByText(
        "ValidateDecisionConsistency found conflicts: The selected spending-data-strategy conflicts with the approved Product Spec.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Review the accepted UX Decision Tiles against the approved Product Spec, update the conflicting selections, accept the deck again, then retry UX Spec generation.",
      ),
    ).toBeTruthy();
  });

  it("hides a stale UX spec failure after a newer successful generation", async () => {
    const specProjectId = "91919191-9191-4191-8191-919191919191";
    const uxSpecId = "33333333-3333-4333-8333-333333333333";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${specProjectId}`]: {
        id: specProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: specProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${specProjectId}/ux-spec/decision-tiles`]: {
        cards: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            projectId: specProjectId,
            kind: "ux",
            key: "spending-data-strategy",
            category: "data",
            title: "Spending data strategy",
            prompt: "Choose how spending data is collected.",
            recommendation: {
              id: "open-banking",
              label: "Open banking",
              description: "Connect transaction accounts directly.",
            },
            alternatives: [],
            selectedOptionId: "open-banking",
            customSelection: null,
            acceptedAt: "2026-03-20T10:00:00.000Z",
            createdAt: "2026-03-20T09:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z",
          },
        ],
      },
      [`/api/projects/${specProjectId}/ux-spec`]: {
        blueprint: {
          id: uxSpecId,
          projectId: specProjectId,
          kind: "ux",
          title: "UX Spec",
          markdown: "# UX Spec",
          isCanonical: true,
          version: 2,
          createdAt: "2026-03-20T10:05:00.000Z",
          updatedAt: "2026-03-20T10:05:00.000Z",
        },
      },
      [`/api/projects/${specProjectId}/ux-spec/versions`]: {
        versions: [],
      },
      [`/api/projects/${specProjectId}/artifacts/blueprint_ux/${uxSpecId}/approval`]: {
        artifactType: "blueprint_ux",
        artifactId: uxSpecId,
        approval: null,
      },
      [`/api/projects/${specProjectId}/jobs`]: {
        jobs: [
          {
            id: "job-blueprint-failed",
            projectId: specProjectId,
            type: "GenerateProjectBlueprint",
            status: "failed",
            inputs: { kind: "ux" },
            outputs: null,
            error: {
              message:
                "ValidateDecisionConsistency found conflicts: The selected spending-data-strategy conflicts with the approved Product Spec.",
            },
            queuedAt: "2026-03-20T10:01:00.000Z",
            startedAt: "2026-03-20T10:01:30.000Z",
            completedAt: "2026-03-20T10:02:00.000Z",
          },
          {
            id: "job-blueprint-succeeded",
            projectId: specProjectId,
            type: "GenerateProjectBlueprint",
            status: "succeeded",
            inputs: { kind: "ux" },
            outputs: { blueprintId: uxSpecId },
            error: null,
            queuedAt: "2026-03-20T10:03:00.000Z",
            startedAt: "2026-03-20T10:03:30.000Z",
            completedAt: "2026-03-20T10:05:00.000Z",
          },
        ],
      },
    });

    renderRoute("/projects/:id/ux-spec", <UxSpecPage />, specProjectId);

    expect((await screen.findAllByRole("heading", { name: "UX Spec" })).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByText("UX Spec generation failed.")).toBeNull();
    });
  });

  it("approves the UX spec without a confirmation dialog and navigates to Technical Spec", async () => {
    const specProjectId = "83838383-8383-4383-8383-838383838383";
    const uxSpecId = "73737373-7373-4373-8373-737373737373";
    let approvalState = {
      artifactType: "blueprint_ux",
      artifactId: uxSpecId,
      approval: null as null | { approvedAt: string },
    };

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: specProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: specProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec/decision-tiles`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            cards: [
              {
                id: "decision-1",
                projectId: specProjectId,
                kind: "ux",
                key: "layout",
                category: "navigation",
                title: "Primary navigation",
                prompt: "Choose the primary navigation approach.",
                recommendation: {
                  id: "sidebar",
                  label: "Sidebar",
                  description: "Persistent section switching.",
                },
                alternatives: [],
                selectedOptionId: "sidebar",
                customSelection: null,
                acceptedAt: "2026-03-20T10:00:00.000Z",
                createdAt: "2026-03-20T09:00:00.000Z",
                updatedAt: "2026-03-20T10:00:00.000Z",
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            blueprint: {
              id: uxSpecId,
              projectId: specProjectId,
              kind: "ux",
              version: 1,
              title: "UX Spec",
              markdown: "# UX Spec",
              source: "GenerateProjectBlueprint",
              isCanonical: true,
              createdAt: "2026-03-20T10:00:00.000Z",
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/ux-spec/versions`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/artifacts/blueprint_ux/${uxSpecId}/approval`) {
        return {
          ok: true,
          status: 200,
          json: async () => approvalState,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/artifacts/blueprint_ux/${uxSpecId}/approve`) {
        approvalState = {
          ...approvalState,
          approval: {
            approvedAt: "2026-03-20T10:05:00.000Z",
          },
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            artifactType: "blueprint_ux",
            artifactId: uxSpecId,
            approvedAt: "2026-03-20T10:05:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createMemoryRouter(
      [
        { path: "/projects/:id/ux-spec", element: <UxSpecPage /> },
        { path: "/projects/:id/technical-spec", element: <div>Technical page</div> },
      ],
      {
        initialEntries: [`/projects/${specProjectId}/ux-spec`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    const approveButton = await screen.findByRole("button", { name: "Approve UX Spec" });
    await waitFor(() => {
      expect(approveButton.hasAttribute("disabled")).toBe(false);
    });
    expect(screen.queryByText("Confirm transition")).toBeNull();

    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/projects/${specProjectId}/artifacts/blueprint_ux/${uxSpecId}/approve`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/projects/${specProjectId}/artifacts/blueprint_ux/${uxSpecId}/approval`,
        expect.anything(),
      );
    });
    expect(await screen.findByText("Technical page")).toBeTruthy();
    expect(screen.queryByText("Confirm transition")).toBeNull();
  });

  it("approves the Technical Spec without a confirmation dialog and navigates to User Flows", async () => {
    const specProjectId = "82828282-8282-4282-8282-828282828282";
    const technicalSpecId = "72727272-7272-4272-8272-727272727272";
    let approvalState = {
      artifactType: "blueprint_tech",
      artifactId: technicalSpecId,
      approval: null as null | { approvedAt: string },
    };

    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (path === "/auth/me") {
        return { ok: true, status: 200, json: async () => ({ user }) } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: specProjectId,
            name: "Quayboard",
            description: "Governed software delivery workspace.",
            state: "READY",
            ownerUserId: specProjectId,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/technical-spec/decision-tiles`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            cards: [
              {
                id: "decision-2",
                projectId: specProjectId,
                kind: "tech",
                key: "api",
                category: "api",
                title: "API shape",
                prompt: "Choose the primary API shape.",
                recommendation: {
                  id: "rest",
                  label: "REST",
                  description: "Straightforward server contracts.",
                },
                alternatives: [],
                selectedOptionId: "rest",
                customSelection: null,
                acceptedAt: "2026-03-20T10:00:00.000Z",
                createdAt: "2026-03-20T09:00:00.000Z",
                updatedAt: "2026-03-20T10:00:00.000Z",
              },
            ],
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/technical-spec`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            blueprint: {
              id: technicalSpecId,
              projectId: specProjectId,
              kind: "tech",
              version: 1,
              title: "Technical Spec",
              markdown: "# Technical Spec",
              source: "GenerateProjectBlueprint",
              isCanonical: true,
              createdAt: "2026-03-20T10:00:00.000Z",
            },
          }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/technical-spec/versions`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ versions: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/jobs`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobs: [] }),
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/artifacts/blueprint_tech/${technicalSpecId}/approval`) {
        return {
          ok: true,
          status: 200,
          json: async () => approvalState,
        } satisfies Partial<Response>;
      }

      if (path === `/api/projects/${specProjectId}/artifacts/blueprint_tech/${technicalSpecId}/approve`) {
        approvalState = {
          ...approvalState,
          approval: {
            approvedAt: "2026-03-20T10:05:00.000Z",
          },
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            artifactType: "blueprint_tech",
            artifactId: technicalSpecId,
            approvedAt: "2026-03-20T10:05:00.000Z",
          }),
        } satisfies Partial<Response>;
      }

      throw new Error(`Unhandled fetch for ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createMemoryRouter(
      [
        { path: "/projects/:id/technical-spec", element: <TechnicalSpecPage /> },
        { path: "/projects/:id/user-flows", element: <div>User Flows page</div> },
      ],
      {
        initialEntries: [`/projects/${specProjectId}/technical-spec`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    const approveButton = await screen.findByRole("button", { name: "Approve Technical Spec" });
    await waitFor(() => {
      expect(approveButton.hasAttribute("disabled")).toBe(false);
    });
    expect(screen.queryByText("Confirm transition")).toBeNull();

    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/projects/${specProjectId}/artifacts/blueprint_tech/${technicalSpecId}/approve`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/projects/${specProjectId}/artifacts/blueprint_tech/${technicalSpecId}/approval`,
        expect.anything(),
      );
    });
    expect(await screen.findByText("User Flows page")).toBeTruthy();
    expect(screen.queryByText("Confirm transition")).toBeNull();
  });

  it("minimizes Technical decisions once a spec exists and allows direct approval without review UI", async () => {
    const specProjectId = "80808080-8080-4080-8080-808080808080";
    const technicalSpecId = "22222222-2222-4222-8222-222222222222";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      [`/api/projects/${specProjectId}`]: {
        id: specProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: specProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${specProjectId}/technical-spec/decision-tiles`]: {
        cards: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            projectId: specProjectId,
            kind: "tech",
            key: "api-shape",
            category: "api",
            title: "API shape",
            prompt: "Choose the primary API style.",
            recommendation: {
              id: "rest",
              label: "REST",
              description: "Keep the service contract straightforward.",
            },
            alternatives: [
              {
                id: "graphql",
                label: "GraphQL",
                description: "Expose a flexible graph endpoint.",
              },
            ],
            selectedOptionId: "rest",
            customSelection: null,
            acceptedAt: "2026-03-19T00:00:00.000Z",
            createdAt: "2026-03-18T00:00:00.000Z",
            updatedAt: "2026-03-18T00:00:00.000Z",
          },
        ],
      },
      [`/api/projects/${specProjectId}/technical-spec`]: {
        blueprint: {
          id: technicalSpecId,
          projectId: specProjectId,
          kind: "tech",
          version: 1,
          title: "Technical Spec",
          markdown: "# Technical Spec\n\nApproved specification.",
          source: "GenerateProjectBlueprint",
          isCanonical: true,
          createdAt: "2026-03-19T00:00:00.000Z",
        },
      },
      [`/api/projects/${specProjectId}/technical-spec/versions`]: {
        versions: [
          {
            id: technicalSpecId,
            projectId: specProjectId,
            kind: "tech",
            version: 1,
            title: "Technical Spec",
            markdown: "# Technical Spec\n\nApproved specification.",
            source: "GenerateProjectBlueprint",
            isCanonical: true,
            createdAt: "2026-03-19T00:00:00.000Z",
          },
        ],
      },
      [`/api/projects/${specProjectId}/phase-gates`]: {
        phases: [
          { phase: "Project Setup", passed: true, items: [] },
          { phase: "Overview Document", passed: true, items: [] },
          { phase: "Product Spec", passed: true, items: [] },
          { phase: "User Flows", passed: true, items: [] },
          { phase: "UX Spec", passed: true, items: [] },
          { phase: "Technical Spec", passed: false, items: [] },
        ],
      },
      [`/api/projects/${specProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/projects/${specProjectId}/artifacts/blueprint_tech/${technicalSpecId}/approval`]: {
        artifactType: "blueprint_tech",
        artifactId: technicalSpecId,
        approval: null,
      },
    });

    renderRoute("/projects/:id/technical-spec", <TechnicalSpecPage />, specProjectId);

    expect((await screen.findAllByRole("heading", { name: "Technical Spec" })).length).toBeGreaterThan(0);
    expect(await screen.findByText("Technical Decision Tiles")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Review Decisions" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Approve Technical Spec" })).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Generate Blueprints" })).toBeNull();
    expect(screen.queryByText("Review Panel")).toBeNull();
  });

  it("hides downstream feature tabs until a Product revision defines requirements", async () => {
    const featureProjectId = "70707070-7070-4070-8070-707070707070";
    const featureId = "61616161-6161-4161-8161-616161616161";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${featureProjectId}`]: {
        id: featureProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: featureProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/features/${featureId}`]: {
        id: featureId,
        projectId: featureProjectId,
        milestoneId: "51515151-5151-4151-8151-515151515151",
        milestoneTitle: "Milestone alpha",
        featureKey: "F-001",
        kind: "screen",
        priority: "must_have",
        status: "draft",
        headRevision: {
          id: "41414141-4141-4141-8141-414141414141",
          featureId,
          version: 1,
          title: "Feature intake",
          summary: "Draft the feature workstreams.",
          acceptanceCriteria: ["A Product spec gates downstream tabs."],
          source: "manual",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
        documents: {
          product: { required: true, state: "missing" },
          ux: { required: false, state: "missing" },
          tech: { required: false, state: "missing" },
          userDocs: { required: false, state: "missing" },
          archDocs: { required: false, state: "missing" },
        },
        taskPlanning: {
          hasTasks: false,
          taskCount: 0,
        },
        dependencyIds: [],
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        archivedAt: null,
      },
      [`/api/projects/${featureProjectId}/features`]: {
        features: [
          {
            id: featureId,
            projectId: featureProjectId,
            milestoneId: "20202020-2020-4020-8020-202020202020",
            milestoneTitle: "Milestone beta",
            featureKey: "F-001",
            kind: "screen",
            priority: "must_have",
            status: "draft",
            headRevision: {
              id: "41414141-4141-4141-8141-414141414141",
              featureId,
              version: 1,
              title: "Feature intake",
              summary: "Draft the feature workstreams.",
              acceptanceCriteria: ["A Product spec gates downstream tabs."],
              source: "manual",
              createdAt: "2026-03-20T00:00:00.000Z",
            },
            documents: {
              product: { required: true, state: "missing" },
              ux: { required: false, state: "missing" },
              tech: { required: false, state: "missing" },
              userDocs: { required: false, state: "missing" },
              archDocs: { required: false, state: "missing" },
            },
            taskPlanning: {
              hasTasks: false,
              taskCount: 0,
            },
            dependencyIds: [],
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            archivedAt: null,
          },
        ],
      },
      [`/api/features/${featureId}/tracks`]: {
        featureId,
        tracks: {
          product: {
            kind: "product",
            required: true,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          ux: {
            kind: "ux",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          tech: {
            kind: "tech",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          userDocs: {
            kind: "user_docs",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          archDocs: {
            kind: "arch_docs",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
        },
      },
      [`/api/projects/${featureProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/features/${featureId}/product-revisions`]: {
        revisions: [],
      },
    });

    const router = createMemoryRouter(
      [{ path: "/projects/:id/features/:featureId", element: <FeatureEditorPage /> }],
      {
        initialEntries: [`/projects/${featureProjectId}/features/${featureId}`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Feature intake" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Product" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "UX" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tech" })).toBeNull();
    expect(screen.queryByRole("button", { name: "User Docs" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Arch Docs" })).toBeNull();
  });

  it("lets users select and inspect older feature workstream revisions", async () => {
    const featureProjectId = "60606060-6060-4060-8060-606060606060";
    const featureId = "50505050-5050-4050-8050-505050505050";
    const productRevisionTwoId = "40404040-4040-4040-8040-404040404040";
    const productRevisionOneId = "30303030-3030-4030-8030-303030303030";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${featureProjectId}`]: {
        id: featureProjectId,
        name: "Quayboard",
        description: "Governed software delivery workspace.",
        state: "READY",
        ownerUserId: featureProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/features/${featureId}`]: {
        id: featureId,
        projectId: featureProjectId,
        milestoneId: "20202020-2020-4020-8020-202020202020",
        milestoneTitle: "Milestone beta",
        featureKey: "F-002",
        kind: "screen",
        priority: "must_have",
        status: "draft",
        headRevision: {
          id: "10101010-1010-4010-8010-101010101010",
          featureId,
          version: 1,
          title: "Revision history",
          summary: "Inspect workstream history.",
          acceptanceCriteria: ["Older revisions remain browsable."],
          source: "manual",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
        documents: {
          product: { required: true, state: "draft" },
          ux: { required: true, state: "missing" },
          tech: { required: true, state: "missing" },
          userDocs: { required: false, state: "missing" },
          archDocs: { required: false, state: "missing" },
        },
        taskPlanning: {
          hasTasks: false,
          taskCount: 0,
        },
        dependencyIds: [],
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        archivedAt: null,
      },
      [`/api/projects/${featureProjectId}/features`]: {
        features: [
          {
            id: featureId,
            projectId: featureProjectId,
            milestoneId: "20202020-2020-4020-8020-202020202020",
            milestoneTitle: "Milestone beta",
            featureKey: "F-002",
            kind: "screen",
            priority: "must_have",
            status: "draft",
            headRevision: {
              id: "10101010-1010-4010-8010-101010101010",
              featureId,
              version: 1,
              title: "Revision history",
              summary: "Inspect workstream history.",
              acceptanceCriteria: ["Older revisions remain browsable."],
              source: "manual",
              createdAt: "2026-03-20T00:00:00.000Z",
            },
            documents: {
              product: { required: true, state: "draft" },
              ux: { required: true, state: "missing" },
              tech: { required: true, state: "missing" },
              userDocs: { required: false, state: "missing" },
              archDocs: { required: false, state: "missing" },
            },
            taskPlanning: {
              hasTasks: false,
              taskCount: 0,
            },
            dependencyIds: [],
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            archivedAt: null,
          },
        ],
      },
      [`/api/features/${featureId}/tracks`]: {
        featureId,
        tracks: {
          product: {
            kind: "product",
            required: true,
            status: "draft",
            headRevision: {
              id: productRevisionTwoId,
              featureId,
              kind: "product",
              version: 2,
              title: "Feature Product Spec",
              markdown: "# Revision Two\n\nCurrent head revision.",
              source: "manual",
              createdAt: "2026-03-21T00:00:00.000Z",
              approval: null,
              requirements: {
                uxRequired: true,
                techRequired: true,
                userDocsRequired: false,
                archDocsRequired: false,
              },
            },
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          ux: {
            kind: "ux",
            required: true,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          tech: {
            kind: "tech",
            required: true,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          userDocs: {
            kind: "user_docs",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          archDocs: {
            kind: "arch_docs",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
        },
      },
      [`/api/projects/${featureProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/features/${featureId}/product-revisions`]: {
        revisions: [
          {
            id: productRevisionTwoId,
            featureId,
            kind: "product",
            version: 2,
            title: "Feature Product Spec",
            markdown: "# Revision Two\n\nCurrent head revision.",
            source: "manual",
            createdAt: "2026-03-21T00:00:00.000Z",
            approval: null,
            requirements: {
              uxRequired: true,
              techRequired: true,
              userDocsRequired: false,
              archDocsRequired: false,
            },
          },
          {
            id: productRevisionOneId,
            featureId,
            kind: "product",
            version: 1,
            title: "Feature Product Spec",
            markdown: "# Revision One\n\nOriginal product direction.",
            source: "manual",
            createdAt: "2026-03-20T00:00:00.000Z",
            approval: null,
            requirements: {
              uxRequired: false,
              techRequired: true,
              userDocsRequired: false,
              archDocsRequired: false,
            },
          },
        ],
      },
      [`/api/features/${featureId}/task-planning-session`]: {
        session: null,
        clarifications: [],
        tasks: [],
      },
      [`/api/features/${featureId}/task-planning-session/tasks`]: {
        tasks: [],
      },
    });

    const router = createMemoryRouter(
      [{ path: "/projects/:id/features/:featureId", element: <FeatureEditorPage /> }],
      {
        initialEntries: [`/projects/${featureProjectId}/features/${featureId}`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByText("Current head revision.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Feature Builder" })).toBeTruthy();
    expect(screen.getAllByText("Feature Product Spec").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Product" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));

    expect(await screen.findByText("No task planning session")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Product" }));

    expect(screen.getByText("Revision 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /v1/i }));

    expect(await screen.findByText("Viewing a historical revision. Saving creates a new head revision.")).toBeTruthy();
    expect(screen.getByText("Revision 1")).toBeTruthy();
    expect(screen.getByText("Original product direction.")).toBeTruthy();
  });

  it("redirects feature editor routes to the feature's owning project", async () => {
    const routeProjectId = "90909090-9090-4090-8090-909090909091";
    const featureProjectId = "91919191-9191-4191-8191-919191919192";
    const featureId = "92929292-9292-4292-8292-929292929293";

    vi.stubGlobal("EventSource", MockEventSource);
    installFetchStub({
      "/auth/me": { user },
      [`/api/projects/${routeProjectId}`]: {
        id: routeProjectId,
        name: "Wrong project",
        description: "Wrong route target.",
        state: "READY",
        ownerUserId: routeProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/projects/${featureProjectId}`]: {
        id: featureProjectId,
        name: "Right project",
        description: "Feature owner.",
        state: "READY",
        ownerUserId: featureProjectId,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-16T10:00:00.000Z",
      },
      [`/api/features/${featureId}`]: {
        id: featureId,
        projectId: featureProjectId,
        milestoneId: "93939393-9393-4393-8393-939393939394",
        milestoneTitle: "Milestone gamma",
        featureKey: "F-003",
        kind: "screen",
        priority: "must_have",
        status: "draft",
        headRevision: {
          id: "94949494-9494-4494-8494-949494949495",
          featureId,
          version: 1,
          title: "Cross-project route",
          summary: "Reject mixed project routes.",
          acceptanceCriteria: ["The route uses the feature's owning project."],
          source: "manual",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
        documents: {
          product: { required: true, state: "missing" },
          ux: { required: false, state: "missing" },
          tech: { required: false, state: "missing" },
          userDocs: { required: false, state: "missing" },
          archDocs: { required: false, state: "missing" },
        },
        taskPlanning: {
          hasTasks: false,
          taskCount: 0,
        },
        dependencyIds: [],
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        archivedAt: null,
      },
      [`/api/projects/${featureProjectId}/features`]: {
        features: [
          {
            id: featureId,
            projectId: featureProjectId,
            milestoneId: "93939393-9393-4393-8393-939393939394",
            milestoneTitle: "Milestone gamma",
            featureKey: "F-003",
            kind: "screen",
            priority: "must_have",
            status: "draft",
            headRevision: {
              id: "94949494-9494-4494-8494-949494949495",
              featureId,
              version: 1,
              title: "Cross-project route",
              summary: "Reject mixed project routes.",
              acceptanceCriteria: ["The route uses the feature's owning project."],
              source: "manual",
              createdAt: "2026-03-20T00:00:00.000Z",
            },
            documents: {
              product: { required: true, state: "missing" },
              ux: { required: false, state: "missing" },
              tech: { required: false, state: "missing" },
              userDocs: { required: false, state: "missing" },
              archDocs: { required: false, state: "missing" },
            },
            taskPlanning: {
              hasTasks: false,
              taskCount: 0,
            },
            dependencyIds: [],
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            archivedAt: null,
          },
        ],
      },
      [`/api/features/${featureId}/tracks`]: {
        featureId,
        tracks: {
          product: {
            kind: "product",
            required: true,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          ux: {
            kind: "ux",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          tech: {
            kind: "tech",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          userDocs: {
            kind: "user_docs",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
          archDocs: {
            kind: "arch_docs",
            required: false,
            status: "draft",
            headRevision: null,
            approvedRevisionId: null,
            implementationStatus: "not_implemented",
            isOutOfDate: false,
          },
        },
      },
      [`/api/projects/${routeProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/projects/${featureProjectId}/jobs`]: {
        jobs: [],
      },
      [`/api/features/${featureId}/product-revisions`]: {
        revisions: [],
      },
    });

    const router = createMemoryRouter(
      [{ path: "/projects/:id/features/:featureId", element: <FeatureEditorPage /> }],
      {
        initialEntries: [`/projects/${routeProjectId}/features/${featureId}`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/projects/${featureProjectId}/features/${featureId}`,
      );
    });
  });
});
