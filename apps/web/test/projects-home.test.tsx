import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project, User } from "@quayboard/shared";

import { ProjectSubNav } from "../src/components/layout/ProjectSubNav.js";
import { NewProjectPage } from "../src/pages/NewProjectPage.js";
import { ProtectedHomePage } from "../src/pages/ProtectedHomePage.js";

const user: User = {
  id: "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9",
  avatarUrl: null,
  createdAt: "2026-03-15T00:00:00.000Z",
  displayName: "Harbor Admin",
  email: "harbor@example.com",
  updatedAt: "2026-03-15T00:00:00.000Z",
};

const renderWithProviders = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

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

describe("project entry surfaces", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the projects home with simplified copy and panel styling", async () => {
    installFetchStub({
      "/auth/me": { user },
      "/api/projects": {
        projects: [
          {
            id: "91a28b19-825c-496f-bc99-205d02664a2e",
            name: "Harbor Console",
            description: "Governed delivery control plane.",
            state: "READY_PARTIAL",
            ownerUserId: user.id,
            createdAt: "2026-03-15T00:00:00.000Z",
            updatedAt: "2026-03-16T10:00:00.000Z",
          },
        ],
      },
    });

    renderWithProviders(<ProtectedHomePage />);

    expect(await screen.findByRole("heading", { name: "Projects", level: 1 })).toBeTruthy();
    expect(await screen.findByText("Harbor Console")).toBeTruthy();
    expect(screen.getByText("Governed delivery control plane.")).toBeTruthy();
    expect(screen.getByText("Open Mission Control")).toBeTruthy();
    expect(screen.getByTestId("projects-list-card").className).toContain("bg-panel-raised");
    expect(screen.getByRole("link", { name: /Harbor Console/i }).className).toContain("border border-border/80");
    expect(screen.queryByText("Workspace Queue")).toBeNull();
    expect(screen.queryByText("Project Queue")).toBeNull();
    expect(screen.queryByText("Active workspaces")).toBeNull();
    expect(screen.queryByText(/scratch path/i)).toBeNull();
    expect(screen.queryByText(/current focus/i)).toBeNull();
  });

  it("renders a projects empty state without workspace jargon", async () => {
    installFetchStub({
      "/auth/me": { user },
      "/api/projects": {
        projects: [],
      },
    });

    renderWithProviders(<ProtectedHomePage />);

    expect(await screen.findByText("No projects yet.")).toBeTruthy();
    expect(
      screen.getByText(
        "Create a project to connect a repository, complete setup, and continue overview, Product Spec, and user-flow planning.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Empty workspace")).toBeNull();
    expect(screen.queryByText("0 projects")).toBeNull();
    expect(screen.queryByText(/scratch path/i)).toBeNull();
  });

  it("renders the new project page without scratch-path language", async () => {
    installFetchStub({
      "/auth/me": { user },
    });

    renderWithProviders(<NewProjectPage />);

    expect(await screen.findByRole("heading", { name: "Create Project" })).toBeTruthy();
    expect(
      screen.getByText(
        "Create the project record here, then move through setup, questions, overview, user flows, Product Spec, UX Spec, and Technical Spec to shape the delivery plan.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("What happens next")).toBeTruthy();
    expect(screen.getByText("Project setup and readiness verification")).toBeTruthy();
    expect(screen.queryByText(/scratch path/i)).toBeNull();
  });

  it("renders the compact project secondary nav without summary copy", () => {
    const project: Project = {
      id: "91a28b19-825c-496f-bc99-205d02664a2e",
      name: "Harbor Console",
      description: null,
      state: "READY_PARTIAL",
      ownerUserId: user.id,
      createdAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-16T10:00:00.000Z",
    };

    render(
      <MemoryRouter>
        <ProjectSubNav project={project} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Harbor Console")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mission Control" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Project Setup" })).toBeTruthy();
    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.textContent)
        .slice(0, 8),
    ).toEqual([
      "Mission Control",
      "Project Setup",
      "Questions",
      "Overview",
      "User Flows",
      "Product Spec",
      "UX Spec",
      "Technical Spec",
    ]);
    expect(screen.queryByText("Project setup and planning for the current delivery phase.")).toBeNull();
    expect(screen.queryByText("Active Project")).toBeNull();
  });
});
