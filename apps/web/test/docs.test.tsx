import { render, screen } from "@testing-library/react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../src/app.js";
import { DocsArticlePage } from "../src/pages/DocsArticlePage.js";
import { DocsHomePage } from "../src/pages/DocsHomePage.js";
import { ImportStubPage } from "../src/pages/ImportStubPage.js";
import { LoginPage } from "../src/pages/LoginPage.js";
import { RegisterPage } from "../src/pages/RegisterPage.js";

const assertNoRoadmapLabels = (text: string) => {
  expect(text).not.toMatch(/\bM\d+\b/);
  expect(text).not.toMatch(/later milestone/i);
};

describe("docs pages", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "unauthorized",
            message: "Authentication is required.",
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the docs landing guide without authentication", () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/docs"]}>
          <DocsHomePage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "User Documentation" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Available Guides" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Authentication" })).toHaveLength(2);
    assertNoRoadmapLabels(document.body.textContent ?? "");
  });

  it("renders a guide article for a known slug", () => {
    const router = createMemoryRouter(
      [{ path: "/docs/:slug", element: <DocsArticlePage /> }],
      { initialEntries: ["/docs/authentication"] },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "Authentication" })).toBeTruthy();
    expect(screen.getAllByText(/currently supports local email\/password authentication/i)).toHaveLength(2);
    assertNoRoadmapLabels(document.body.textContent ?? "");
  });

  it("shows a not-found state for an unknown guide slug", () => {
    const router = createMemoryRouter(
      [{ path: "/docs/:slug", element: <DocsArticlePage /> }],
      { initialEntries: ["/docs/missing-guide"] },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(screen.getByText("Guide not found")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to docs home" })).toBeTruthy();
  });

  it("links to the docs from the login page", () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByRole("link", { name: "Browse docs" })).toBeTruthy();
    expect(screen.getByText(/access your quayboard workspace/i)).toBeTruthy();
    assertNoRoadmapLabels(document.body.textContent ?? "");
  });

  it("renders the register page without roadmap labels", () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText(/create a local account for this quayboard instance/i)).toBeTruthy();
    assertNoRoadmapLabels(document.body.textContent ?? "");
  });

  it("renders the import stub without roadmap labels", () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <ImportStubPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText(/repository import is not available yet/i)).toBeTruthy();
    assertNoRoadmapLabels(document.body.textContent ?? "");
  });

  it("renders the planning workflow guide without roadmap labels", () => {
    const router = createMemoryRouter(
      [{ path: "/docs/:slug", element: <DocsArticlePage /> }],
      { initialEntries: ["/docs/planning-workflow"] },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "Planning Workflow" })).toBeTruthy();
    expect(screen.getByText(/the import path remains a stub for now/i)).toBeTruthy();
    assertNoRoadmapLabels(document.body.textContent ?? "");
  });
});
