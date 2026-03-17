import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "../src/pages/LoginPage.js";
import { RegisterPage } from "../src/pages/RegisterPage.js";

const installReadinessFetchStub = (checks: Array<{
  key: string;
  label: string;
  status: "fail" | "pass" | "warn";
  message: string;
}>) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const path = typeof input === "string" ? input : input.toString();

      if (path !== "/api/system/readiness") {
        throw new Error(`Unhandled fetch for ${path}`);
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ checks }),
      } satisfies Partial<Response>;
    }),
  );
};

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("blocks sign-in until every readiness check passes", async () => {
    installReadinessFetchStub([
      {
        key: "database",
        label: "Database",
        status: "pass",
        message: "Database connection succeeded.",
      },
      {
        key: "encryption_key",
        label: "Encryption Key",
        status: "fail",
        message:
          "SECRETS_ENCRYPTION_KEY is missing. Add it to .env, restart the API, then reload this page.",
      },
    ]);

    renderWithProviders(<LoginPage />);

    expect(await screen.findByText("Sign-in stays locked until every failed check below is fixed.")).toBeTruthy();
    expect(screen.getByText("Sign-in is unavailable until the failed readiness checks are resolved.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "first install guide" }).getAttribute("href")).toBe("/docs/first-install");
    expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/SECRETS_ENCRYPTION_KEY is missing/i)).toBeTruthy();
    expect(screen.queryByText("deployment checks")).toBeNull();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("enables registration once readiness is fully green", async () => {
    installReadinessFetchStub([
      {
        key: "database",
        label: "Database",
        status: "pass",
        message: "Database connection succeeded.",
      },
      {
        key: "encryption_key",
        label: "Encryption Key",
        status: "pass",
        message: "Secrets encryption key is configured.",
      },
    ]);

    renderWithProviders(<RegisterPage />);

    expect(await screen.findByText("All instance checks are green. You can create an account from this page.")).toBeTruthy();
    expect(screen.queryByText("deployment checks")).toBeNull();
    expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(false);
  });
});
