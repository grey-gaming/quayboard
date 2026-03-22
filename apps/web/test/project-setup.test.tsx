import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import type { ProjectSetupState } from "@quayboard/shared";

import { AppProviders } from "../src/app.js";
import { SetupCompletionGate } from "../src/components/layout/SetupCompletionGate.js";
import { OnePagerQuestionsPage } from "../src/pages/OnePagerQuestionsPage.js";
import { ProjectSetupPage } from "../src/pages/ProjectSetupPage.js";

const projectId = "c6cca021-c7f3-4e9b-8cbe-599fe43fafc9";

class MockEventSource {
  addEventListener() {}

  removeEventListener() {}

  close() {}
}

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

  it("renders setup as section cards, saves repositories, and auto-verifies Ollama selections", async () => {
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
          const payload =
            typeof init?.body === "string"
              ? (JSON.parse(init.body) as {
                  evidencePolicy?: ProjectSetupState["evidencePolicy"];
                  llmConfig?: { model: string; provider: "ollama" | "openai" };
                  repoConfig?: { owner: string; repo: string };
                  sandboxConfig?: ProjectSetupState["sandboxConfig"];
                })
              : {};

          if (payload.repoConfig) {
            setupState = {
              ...setupState,
              repo: {
                ...setupState.repo,
                selectedRepo: {
                  owner: payload.repoConfig.owner,
                  repo: payload.repoConfig.repo,
                  fullName: `${payload.repoConfig.owner}/${payload.repoConfig.repo}`,
                  defaultBranch: "main",
                  repoUrl: `https://github.com/${payload.repoConfig.owner}/${payload.repoConfig.repo}`,
                },
              },
            };
          }

          if (payload.llmConfig) {
            setupState = {
              ...setupState,
              llm: {
                ...setupState.llm,
                model: payload.llmConfig.model,
                provider: payload.llmConfig.provider,
              },
            };
          }

          if (payload.sandboxConfig) {
            setupState = {
              ...setupState,
              sandboxConfig: payload.sandboxConfig,
            };
          }

          if (payload.evidencePolicy) {
            setupState = {
              ...setupState,
              evidencePolicy: payload.evidencePolicy,
            };
          }

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

        if (path === `/api/projects/${projectId}/verify-llm` && method === "POST") {
          setupState = {
            ...setupState,
            llm: {
              ...setupState.llm,
              verified: true,
            },
            status: {
              ...setupState.status,
              llmVerified: true,
              checks: setupState.status.checks.map((check) =>
                check.key === "llm"
                  ? {
                      ...check,
                      status: "pass",
                      message: "LLM provider verified.",
                    }
                  : check,
              ),
            },
          };

          return {
            ok: true,
            status: 200,
            json: async () => setupState.status,
          } satisfies Partial<Response>;
        }

        throw new Error(`Unhandled fetch for ${method} ${path}`);
      }),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    expect(screen.getAllByText("Repository Access").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Model Configuration").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sandbox Defaults").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence And Documentation").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Planning workflow" })[0]?.getAttribute("href")).toBe(
      "/docs/planning-workflow",
    );
    expect(screen.getByRole("link", { name: "First install" }).getAttribute("href")).toBe(
      "/docs/first-install",
    );
    expect(screen.queryByText("Readiness Checklist")).toBeNull();
    expect(screen.queryByText("Controls")).toBeNull();

    await user.type(screen.getByLabelText("GitHub PAT"), "ghp_valid_pat");
    await user.click(screen.getByRole("button", { name: "Validate PAT" }));

    await screen.findByRole("option", { name: "acme/service-api" });
    await user.selectOptions(screen.getByLabelText("GitHub repo"), "acme/service-api");
    await user.click(screen.getByRole("button", { name: "Save Repository" }));

    await waitFor(() => {
      const savedBadges = screen.getAllByText("saved");

      expect(savedBadges.length).toBeGreaterThan(0);
      savedBadges.forEach((badge) => {
        expect(badge.className).toContain("text-success");
        expect(badge.className).not.toContain("text-secondary");
      });
    });

    await user.selectOptions(screen.getByLabelText("LLM provider"), "ollama");
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "llama3.2" })).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: "Verify LLM" })).toBeNull();

    await user.selectOptions(screen.getByLabelText("Model"), "llama3.2");

    await waitFor(() => {
      expect(screen.getAllByText("verified").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("button", { name: "Complete Setup" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.queryByRole("link", { name: "Product Design" })).toBeNull();
    expect(screen.getByText("Product Design", { selector: "span" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("shows Fastify validation messages when sandbox save fails before verification", async () => {
    const user = userEvent.setup();
    const setupState = baseSetupState();

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

        if (path === `/api/projects/${projectId}` && method === "PATCH") {
          return {
            ok: false,
            status: 400,
            headers: new Headers({
              "content-type": "application/json",
            }),
            json: async () => ({
              statusCode: 400,
              code: "FST_ERR_VALIDATION",
              error: "Bad Request",
              message: "body/sandboxConfig/memoryMb must be integer",
            }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unhandled fetch for ${method} ${path}`);
      }),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Verify Sandbox" }));

    expect(
      await screen.findByText("body/sandboxConfig/memoryMb must be integer"),
    ).toBeTruthy();
  });

  it("keeps explicit LLM verification for the openai-compatible flow", async () => {
    const user = userEvent.setup();
    const isolatedProjectId = "7cf8405e-3f3d-4ad8-a9b2-5f2776184b4b";
    let setupState: ProjectSetupState = {
      ...baseSetupState(),
      llm: {
        availableModels: [],
        model: "gpt-4.1",
        provider: "openai" as const,
        verified: false,
      },
    };

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
          setupState = {
            ...setupState,
            llm: {
              ...setupState.llm,
              verified: true,
            },
            status: {
              ...setupState.status,
              llmVerified: true,
              checks: setupState.status.checks.map((check) =>
                check.key === "llm"
                  ? {
                      ...check,
                      status: "pass",
                      message: "LLM provider verified.",
                    }
                  : check,
              ),
            },
          };

          return {
            ok: true,
            status: 200,
            json: async () => setupState.status,
          } satisfies Partial<Response>;
        }

        throw new Error(`Unhandled fetch for ${method} ${path}`);
      }),
    );

    renderPage(isolatedProjectId);

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verify LLM" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Verify LLM" }));

    await waitFor(() => {
      expect(screen.getAllByText("verified").length).toBeGreaterThan(0);
    });
  });

  it("completes setup only after the required checks pass and then unlocks later sections", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("EventSource", MockEventSource);
    let project = {
      id: projectId,
      name: "Harbor Control",
      description: "Governed setup flow",
      state: "BOOTSTRAPPING",
      ownerUserId: projectId,
      createdAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-17T00:00:00.000Z",
    };
    let setupState: ProjectSetupState = {
      ...baseSetupState(),
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
      status: {
        checks: [
          {
            key: "repo",
            label: "Repository",
            status: "pass",
            message: "Repository access verified.",
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
        llmVerified: true,
        repoConnected: true,
        sandboxVerified: false,
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (path === `/api/projects/${projectId}` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => project,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/setup` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => setupState,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/setup-status` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => setupState.status,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/questionnaire-answers` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              projectId,
              answers: {},
              updatedAt: "2026-03-17T00:00:00.000Z",
              completedAt: null,
            }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/one-pager` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ onePager: null }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/product-spec` && method === "GET") {
          return {
            ok: true,
            status: 409,
            json: async () => ({
              error: {
                code: "overview_approval_required",
                message: "Approve the overview document before using Product Spec.",
              },
            }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/one-pager/versions` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ versions: [] }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/jobs` && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ jobs: [] }),
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}` && method === "PATCH") {
          return {
            ok: true,
            status: 200,
            json: async () => project,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/verify-sandbox` && method === "POST") {
          setupState = {
            ...setupState,
            status: {
              ...setupState.status,
              sandboxVerified: true,
              checks: setupState.status.checks.map((check) =>
                check.key === "sandbox"
                  ? {
                      ...check,
                      status: "pass",
                      message: "Sandbox startup verified.",
                    }
                  : check,
              ),
            },
          };

          return {
            ok: true,
            status: 200,
            json: async () => setupState.status,
          } satisfies Partial<Response>;
        }

        if (path === `/api/projects/${projectId}/complete-setup` && method === "POST") {
          project = {
            ...project,
            state: "READY_PARTIAL",
          };

          return {
            ok: true,
            status: 200,
            json: async () => project,
          } satisfies Partial<Response>;
        }

        throw new Error(`Unhandled fetch for ${method} ${path}`);
      }),
    );

    const router = createMemoryRouter(
      [
        { path: "/projects/:id/setup", element: <ProjectSetupPage /> },
        {
          element: <SetupCompletionGate />,
          children: [
            { path: "/projects/:id/questions", element: <OnePagerQuestionsPage /> },
          ],
        },
      ],
      {
        initialEntries: [`/projects/${projectId}/setup`],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Project Setup" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete Setup" }).hasAttribute("disabled")).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: "Verify Sandbox" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Complete Setup" }).hasAttribute("disabled")).toBe(
        false,
      );
    });

    await user.click(screen.getByRole("button", { name: "Complete Setup" }));

    expect(
      await screen.findByRole("heading", {
        name: "Questions",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Use these 14 prompts to capture project intent before generating the overview. Answers save automatically, and the LLM can fill only the fields you leave blank.",
      ),
    ).toBeTruthy();
  });
});
