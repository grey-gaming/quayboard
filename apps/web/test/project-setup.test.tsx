import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import type { ProjectSetupState } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { ProjectSetupPage } from "../src/pages/ProjectSetupPage.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";

const baseSetupState = (): ProjectSetupState => ({
  evidencePolicy: {
    requireArchitectureDocs: false,
    requireUserDocs: false,
  },
  llm: {
    availableModels: [],
    model: null,
    provider: null,
    verified: false,
  },
  repo: {
    availableRepos: [],
    patConfigured: false,
    selectedRepo: null,
    viewerLogin: null,
  },
  sandboxConfig: {
    allowlist: [],
    cpuLimit: 1,
    egressPolicy: "locked",
    memoryMb: 1024,
    timeoutSeconds: 300,
  },
  status: {
    checks: [
      {
        key: "repo",
        label: "Repository",
        status: "fail",
        message: "Connect and verify a repository.",
      },
      {
        key: "llm",
        label: "LLM Provider",
        status: "fail",
        message: "Configure a provider and verify connectivity.",
      },
      {
        key: "sandbox",
        label: "Sandbox",
        status: "fail",
        message: "Configure sandbox defaults and verify startup.",
      },
    ],
    llmVerified: false,
    repoConnected: false,
    sandboxVerified: false,
  },
  toolPolicyPreview: {
    budgetCapUsd: null,
    enabledGroups: ["planning", "review"],
  },
});

const renderPage = (activeProjectId = projectId) => {
  const router = createMemoryRouter(
    [{ path: "/projects/:id/setup", element: <ProjectSetupPage /> }],
    {
      initialEntries: [`/projects/${activeProjectId}/setup`],
    },
  );

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

describe("project setup page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads repositories from a validated PAT and fetches Ollama models on provider selection", async () => {
    const user = userEvent.setup();
    let setupState = baseSetupState();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (path === `/api/projects/${projectId}` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: projectId,
              name: "Harbor Control",
              description: "Governed setup flow",
              state: "BOOTSTRAPPING",
              ownerUserId: projectId,
              createdAt: "2026-03-15T00:00:00.000Z",
              updatedAt: "2026-03-17T00:00:00.000Z",
            }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/setup` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => setupState,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/github-pat/validate` && method === "POST") {
          setupState = {
            ...setupState,
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
              selectedRepo: null,
              viewerLogin: "acme-admin",
            },
          };

          return {
            ok: true,
            status: 200,
            json: async () => setupState,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/llm-models` && method === "POST") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: ["llama3.2", "mistral-nemo"],
            }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}` && method === "PATCH") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: projectId,
              name: "Harbor Control",
              description: "Governed setup flow",
              state: "BOOTSTRAPPING",
              ownerUserId: projectId,
              createdAt: "2026-03-15T00:00:00.000Z",
              updatedAt: "2026-03-17T00:00:00.000Z",
            }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unhandled fetch for ${method} ${path}`);
      }),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    expect(screen.queryByLabelText("GitHub owner")).toBeNull();
    expect((screen.getByLabelText("LLM provider") as HTMLSelectElement).value).toBe("");

    await user.type(screen.getByLabelText("GitHub PAT"), "ghp_valid_pat");
    await user.click(screen.getByRole("button", { name: "Validate PAT" }));

    await screen.findByRole("option", { name: "acme/service-api" });
    expect(screen.getByText("Connected as acme-admin")).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("LLM provider"), "ollama");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "llama3.2" })).toBeTruthy();
    });
    expect(screen.getByLabelText("Model").tagName).toBe("SELECT");
  });

  it("updates the readiness checklist immediately from verify responses", async () => {
    const user = userEvent.setup();
    const isolatedProjectId = "7cf8405e-3f3d-4ad8-a9b2-5f2776184b4b";
    const setupState = {
      ...baseSetupState(),
      llm: {
        availableModels: [],
        model: "gpt-4.1",
        provider: "openai" as const,
        verified: false,
      },
    } satisfies ProjectSetupState;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (path === `/api/projects/${isolatedProjectId}` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: isolatedProjectId,
              name: "Harbor Control",
              description: "Governed setup flow",
              state: "BOOTSTRAPPING",
              ownerUserId: isolatedProjectId,
              createdAt: "2026-03-15T00:00:00.000Z",
              updatedAt: "2026-03-17T00:00:00.000Z",
            }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${isolatedProjectId}/setup` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => setupState,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${isolatedProjectId}` && method === "PATCH") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: isolatedProjectId,
              name: "Harbor Control",
              description: "Governed setup flow",
              state: "BOOTSTRAPPING",
              ownerUserId: isolatedProjectId,
              createdAt: "2026-03-15T00:00:00.000Z",
              updatedAt: "2026-03-17T00:00:00.000Z",
            }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${isolatedProjectId}/verify-llm` && method === "POST") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              repoConnected: false,
              llmVerified: true,
              sandboxVerified: false,
              checks: [
                {
                  key: "repo",
                  label: "Repository",
                  status: "fail",
                  message: "Connect and verify a repository.",
                },
                {
                  key: "llm",
                  label: "LLM Provider",
                  status: "pass",
                  message: "LLM provider verified.",
                },
                {
                  key: "sandbox",
                  label: "Sandbox",
                  status: "fail",
                  message: "Configure sandbox defaults and verify startup.",
                },
              ],
            }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unhandled fetch for ${method} ${path}`);
      }),
    );

    renderPage(isolatedProjectId);

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Verify LLM" })).toHaveProperty(
        "disabled",
        false,
      );
    });

    await user.click(screen.getByRole("button", { name: "Verify LLM" }));

    await waitFor(() => {
      expect(screen.getByText("LLM provider verified.")).toBeTruthy();
    });
    expect(screen.getByText("pass")).toBeTruthy();
  });
});
