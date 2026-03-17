import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { GlobalHeader } from "../src/components/layout/GlobalHeader.js";
import { SettingsPage } from "../src/pages/SettingsPage.js";

const user: User = {
  id: "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9",
  avatarUrl: null,
  createdAt: "2026-03-15T00:00:00.000Z",
  displayName: "Harbor Admin",
  email: "harbor@example.com",
  updatedAt: "2026-03-15T00:00:00.000Z",
};

describe("global navigation", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders authenticated header actions", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <GlobalHeader projectsHref="/" user={user} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Docs" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quayboard" })).toBeTruthy();
    expect(screen.getByText("Harbor Admin")).toBeTruthy();
    expect(screen.queryByText("Control Plane")).toBeNull();
    expect(screen.queryByText("Operator")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("renders unauthenticated docs header actions", () => {
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <GlobalHeader projectsHref="/login" user={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Docs" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Register" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("renders the settings landing page with an instance readiness shortcut", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user }),
      }),
    );

    render(
      <AppProviders>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Instance Readiness" }).getAttribute("href")).toBe(
      "/setup/instance",
    );
  });
});
