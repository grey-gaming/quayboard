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
        message: "Set SECRETS_ENCRYPTION_KEY before continuing.",
      },
    ]);

    renderWithProviders(<LoginPage />);

    expect(await screen.findByText("Resolve all failing checks first.")).toBeTruthy();
    expect(screen.getByText("Resolve every instance readiness check before signing in.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Set SECRETS_ENCRYPTION_KEY before continuing.")).toBeTruthy();
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

    expect(await screen.findByText("Ready for account creation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(false);
  });
});
