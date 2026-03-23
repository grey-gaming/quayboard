import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project, User } from "@quayboard/shared";

import { ProjectNavigationStack } from "../src/components/layout/ProjectNavigationStack.js";
import { buildSetupTertiaryItems } from "../src/components/layout/project-navigation.js";
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
        "Create the project record here, then move through setup, questions, overview, Product Spec, UX Spec, Technical Spec, and user flows to shape the delivery plan.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("What happens next")).toBeTruthy();
    expect(screen.getByText("Project setup and readiness verification")).toBeTruthy();
    expect(screen.queryByText(/scratch path/i)).toBeNull();
  });

  it("renders grouped project navigation with setup tertiary links", () => {
    const project: Project = {
      id: "91a28b19-825c-496f-bc99-205d02664a2e",
      name: "Harbor Console",
      description: null,
      state: "READY",
      ownerUserId: user.id,
      createdAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-16T10:00:00.000Z",
    };

    render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/questions`]}>
        <ProjectNavigationStack
          activeSection="setup"
          project={project}
          tertiaryItems={buildSetupTertiaryItems(project)}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Harbor Console")).toBeTruthy();
    expect(screen.getByText("Harbor Console").tagName).toBe("SPAN");
    expect(screen.getByRole("link", { name: "Mission Control" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Setup" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Product Design" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Feature Design" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Project Setup" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Questions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Import" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Setup" }).className).toContain("qb-project-nav-cell-secondary-active");
    expect(screen.getByRole("link", { name: "Questions" }).className).toContain("qb-project-nav-cell-tertiary-active");
    expect(screen.getByText("Implementation")).toBeTruthy();
  });

  it("renders locked grouped navigation when setup is incomplete", () => {
    const project: Project = {
      id: "91a28b19-825c-496f-bc99-205d02664a2e",
      name: "Harbor Console",
      description: null,
      state: "BOOTSTRAPPING",
      ownerUserId: user.id,
      createdAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-16T10:00:00.000Z",
    };

    render(
      <MemoryRouter>
        <ProjectNavigationStack
          activeSection="setup"
          project={project}
          tertiaryItems={buildSetupTertiaryItems(project)}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Questions" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Import" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Product Design" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Feature Design" })).toBeNull();
    expect(screen.getByText("Questions")).toBeTruthy();
    expect(screen.getByText("Import")).toBeTruthy();
    expect(screen.getByText("Product Design")).toBeTruthy();
  });
});
