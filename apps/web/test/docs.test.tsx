import { render, screen } from "@testing-library/react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../src/app.js";
import { DocsArticlePage } from "../src/pages/DocsArticlePage.js";
import { DocsHomePage } from "../src/pages/DocsHomePage.js";
import { LoginPage } from "../src/pages/LoginPage.js";

describe("docs pages", () => {
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
    expect(screen.getAllByRole("link", { name: "Authentication" })).toHaveLength(2);
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
    expect(screen.getAllByText(/minimal local authentication flow/i)).toHaveLength(2);
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
  });
});
