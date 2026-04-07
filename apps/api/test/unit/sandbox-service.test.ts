import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import {
  createSandboxService,
  determineNetworkModeForRun,
  serializeProjectReviewFixFindings,
} from "../../src/services/sandbox-service.js";

const makeExecError = (message: string, stderr = "") => {
  const error = new Error(message) as Error & { stderr?: string; stdout?: string };
  error.stderr = stderr;
  error.stdout = "";
  return error;
};

const makeService = (overrides: {
  artifactStorageService?: Record<string, unknown>;
  db?: Record<string, unknown>;
  dockerService?: Record<string, unknown>;
  executionSettingsService?: Record<string, unknown>;
  featureService?: Record<string, unknown>;
  featureWorkstreamService?: Record<string, unknown>;
  githubService?: Record<string, unknown>;
  taskPlanningService?: Record<string, unknown>;
} = {}) =>
  createSandboxService({
    artifactStorageService: (overrides.artifactStorageService ?? {
      deletePath: vi.fn().mockResolvedValue(undefined),
      pruneRunDirectories: vi.fn().mockResolvedValue(undefined),
    }) as never,
    contextPackService: {} as never,
    db: (overrides.db ?? {
      query: {
        featureCasesTable: { findFirst: vi.fn().mockResolvedValue(null) },
        featureRevisionsTable: { findFirst: vi.fn().mockResolvedValue(null) },
        milestonesTable: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    }) as never,
    dockerService: (overrides.dockerService ?? {
      listManagedContainers: vi.fn().mockResolvedValue([]),
      pruneManagedResources: vi.fn().mockResolvedValue(undefined),
      removeContainer: vi.fn().mockResolvedValue(undefined),
    }) as never,
    executionSettingsService: (overrides.executionSettingsService ?? {
      get: vi.fn().mockResolvedValue({
        defaultImage: "quayboard-agent-sandbox:latest",
        dockerHost: null,
        maxConcurrentRuns: 2,
        defaultTimeoutSeconds: 900,
        defaultCpuLimit: 1,
        defaultMemoryMb: 2048,
      }),
    }) as never,
    featureService: (overrides.featureService ?? {
      get: vi.fn(),
    }) as never,
    featureWorkstreamService: (overrides.featureWorkstreamService ?? {}) as never,
    githubService: (overrides.githubService ?? {
      branchExists: vi.fn().mockResolvedValue(false),
      createPullRequest: vi.fn().mockResolvedValue({ url: "https://github.com/acme/repo/pull/1" }),
      findOpenPullRequestForHead: vi.fn().mockResolvedValue(null),
    }) as never,
    llmRuntimeDefaults: {
      ollamaHost: "http://127.0.0.1:11434/v1",
      openAiBaseUrl: "https://api.openai.com/v1",
    },
    secretService: {} as never,
    sseHub: {} as never,
    taskPlanningService: (overrides.taskPlanningService ?? {}) as never,
  });

describe("sandbox service", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it("uses internet-capable networking for implement runs even when project egress is locked", () => {
    expect(
      determineNetworkModeForRun({
        baseUrl: "https://api.openai.com/v1",
        egressPolicy: "locked",
        provider: "openai",
        runKind: "implement",
      }),
    ).toBe("bridge");
  });

  it("uses internet-capable networking for verify runs even when project egress is locked", () => {
    expect(
      determineNetworkModeForRun({
        baseUrl: "https://api.openai.com/v1",
        egressPolicy: "locked",
        provider: "openai",
        runKind: "verify",
      }),
    ).toBe("bridge");
  });

  it("uses internet-capable networking for project fix runs even when project egress is locked", () => {
    expect(
      determineNetworkModeForRun({
        baseUrl: "https://api.openai.com/v1",
        egressPolicy: "locked",
        provider: "openai",
        runKind: "project_fix",
      }),
    ).toBe("bridge");
  });

  it("preserves host networking for delivery runs that use a local model endpoint", () => {
    expect(
      determineNetworkModeForRun({
        baseUrl: "http://127.0.0.1:11434/v1",
        egressPolicy: "locked",
        provider: "ollama",
        runKind: "implement",
      }),
    ).toBe("host");
  });

  it("keeps non-delivery runs locked when project egress is locked", () => {
    expect(
      determineNetworkModeForRun({
        baseUrl: "https://api.openai.com/v1",
        egressPolicy: "locked",
        provider: "openai",
        runKind: "project_review",
      }),
    ).toBe("none");
  });

  it("serializes only still-open findings for project fix runs", () => {
    expect(
      JSON.parse(
        serializeProjectReviewFixFindings([
          {
            id: "finding-open",
            category: "tests",
            severity: "high",
            finding: "Open issue",
            evidence: [{ path: "src/open.ts" }],
            whyItMatters: "Still failing.",
            recommendedImprovement: "Fix it.",
            status: "open",
          },
          {
            id: "finding-ignored",
            category: "documentation",
            severity: "low",
            finding: "Ignored issue",
            evidence: [{ path: "README.md" }],
            whyItMatters: "Minor.",
            recommendedImprovement: "Optional.",
            status: "ignored",
          },
        ]),
      ),
    ).toEqual([
      {
        id: "finding-open",
        category: "tests",
        severity: "high",
        finding: "Open issue",
        evidence: [{ path: "src/open.ts" }],
        whyItMatters: "Still failing.",
        recommendedImprovement: "Fix it.",
        status: "open",
      },
    ]);
  });

  it("falls back to a branchless clone when the configured default branch does not exist yet", async () => {
    const token = "github_pat_secret";

    execFileMock
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(
            makeExecError(
              `Command failed: git clone --depth 1 --branch main https://x-access-token:${token}@github.com/grey-gaming/hello-world /tmp/workspace`,
              "fatal: Remote branch main not found in upstream origin",
            ),
          );
        },
      )
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, {
            stdout: "",
            stderr: "warning: You appear to have cloned an empty repository.",
          });
        },
      )
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(makeExecError("fatal: Needed a single revision"));
        },
      )
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, { stdout: "", stderr: "" });
        },
      );

    const service = makeService();

    await expect(
      service.cloneRepository(
        "https://github.com/grey-gaming/hello-world",
        "main",
        token,
        "/tmp/workspace",
      ),
    ).resolves.toBeUndefined();

    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      [
        "clone",
        "--depth",
        "1",
        "--branch",
        "main",
        `https://x-access-token:${token}@github.com/grey-gaming/hello-world`,
        "/tmp/workspace",
      ],
      [
        "clone",
        `https://x-access-token:${token}@github.com/grey-gaming/hello-world`,
        "/tmp/workspace",
      ],
      ["rev-parse", "--verify", "HEAD"],
      ["symbolic-ref", "HEAD", "refs/heads/main"],
    ]);
  });

  it("redacts embedded credentials from git errors", async () => {
    const token = "github_pat_secret";

    execFileMock.mockImplementationOnce(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
      ) => {
        callback(
          makeExecError(
            `Command failed: git clone --depth 1 --branch main https://x-access-token:${token}@github.com/grey-gaming/hello-world /tmp/workspace`,
            "fatal: Authentication failed for 'https://x-access-token:github_pat_secret@github.com/grey-gaming/hello-world/'",
          ),
        );
      },
    );

    const service = makeService();

    let thrown: unknown;
    const clonePromise = service.cloneRepository(
      "https://github.com/grey-gaming/hello-world",
      "main",
      token,
      "/tmp/workspace",
    );
    await expect(
      clonePromise,
    ).rejects.toThrow("[redacted]");

    try {
      await clonePromise;
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(token);
  });

  it("reuses the existing milestone pull request when publishing more milestone work", async () => {
    const githubService = {
      branchExists: vi.fn().mockResolvedValue(true),
      createPullRequest: vi.fn(),
      findOpenPullRequestForHead: vi.fn().mockResolvedValue({
        number: 7,
        url: "https://github.com/acme/repo/pull/7",
      }),
    };
    const db = {
      query: {
        featureCasesTable: {
          findFirst: vi.fn().mockResolvedValue({
            id: "feature-1",
            featureKey: "F-001",
          }),
        },
        featureRevisionsTable: {
          findFirst: vi.fn().mockResolvedValue({
            id: "rev-1",
            title: "Counter UI",
          }),
        },
      },
    };
    const service = makeService({ db, githubService });
    service.hasWorkingTreeChanges = vi.fn().mockResolvedValue(true);
    service.hasStagedChanges = vi.fn().mockResolvedValue(true);
    service.updateRunState = vi.fn().mockResolvedValue(undefined);
    service.git = vi.fn().mockImplementation(async (args: string[]) => {
      if (args[0] === "branch") {
        return "quayboard/m-001/abcd1234";
      }
      if (args[0] === "rev-parse") {
        return "commit-sha";
      }
      return "";
    });

    const result = await service.publishPullRequestIfNeeded(
      "/tmp/workspace",
      {
        owner: "acme",
        name: "repo",
        repoUrl: "https://github.com/acme/repo",
      } as never,
      "github_pat_secret",
      "Implement F-001: Counter UI",
      "run-1",
      {
        baseBranchName: "main",
        cloneBranchName: "quayboard/m-001/abcd1234",
        targetBranchName: "quayboard/m-001/abcd1234",
        pullRequestTitle: "Deliver milestone",
        pullRequestBody: "body",
      },
      "base-sha",
    );

    expect(githubService.findOpenPullRequestForHead).toHaveBeenCalledWith(
      expect.objectContaining({ head: "quayboard/m-001/abcd1234" }),
    );
    expect(githubService.createPullRequest).not.toHaveBeenCalled();
    expect(service.updateRunState).toHaveBeenCalledWith("run-1", {
      branchName: "quayboard/m-001/abcd1234",
      pullRequestUrl: "https://github.com/acme/repo/pull/7",
    });
    expect(result.pullRequestUrl).toBe("https://github.com/acme/repo/pull/7");
  });

  it("removes transient git message files before committing publish changes", async () => {
    const service = makeService({
      db: {
        query: {
          featureCasesTable: { findFirst: vi.fn().mockResolvedValue(null) },
          featureRevisionsTable: { findFirst: vi.fn().mockResolvedValue(null) },
          milestonesTable: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      },
    });
    const cleanupTransientGitMessageFiles = vi.fn().mockResolvedValue(undefined);
    const git = vi.fn().mockImplementation(async (args: string[]) => {
      if (args[0] === "branch") {
        return "quayboard/m-001/abcd1234";
      }
      if (args[0] === "rev-parse") {
        return "commit-sha";
      }
      return "";
    });

    service.hasWorkingTreeChanges = vi.fn().mockResolvedValue(true);
    service.hasStagedChanges = vi.fn().mockResolvedValue(true);
    service.cleanupTransientGitMessageFiles = cleanupTransientGitMessageFiles;
    service.git = git;
    service.updateRunState = vi.fn().mockResolvedValue(undefined);

    await service.publishPullRequestIfNeeded(
      "/tmp/workspace",
      {
        owner: "acme",
        name: "repo",
        repoUrl: "https://github.com/acme/repo",
      } as never,
      "github_pat_secret",
      "Implement F-001: Counter UI",
      "run-1",
      {
        baseBranchName: "main",
        cloneBranchName: "quayboard/m-001/abcd1234",
        targetBranchName: "quayboard/m-001/abcd1234",
        pullRequestTitle: "Deliver milestone",
        pullRequestBody: "body",
      },
      "base-sha",
    );

    expect(cleanupTransientGitMessageFiles).toHaveBeenCalledWith("/tmp/workspace");
    expect(git).toHaveBeenCalledWith(
      ["commit", "-m", "Implement F-001: Counter UI"],
      "/tmp/workspace",
    );
    const commitCallIndex = git.mock.calls.findIndex((call) => call[0][0] === "commit");
    expect(commitCallIndex).toBeGreaterThanOrEqual(0);
    expect(cleanupTransientGitMessageFiles.mock.invocationCallOrder[0]).toBeLessThan(
      git.mock.invocationCallOrder[commitCallIndex],
    );
  });

  it("creates a fresh fix branch from the default branch after a milestone has been merged", async () => {
    const githubService = {
      branchExists: vi.fn().mockResolvedValue(false),
      createPullRequest: vi.fn().mockResolvedValue({
        url: "https://github.com/acme/repo/pull/9",
      }),
      findOpenPullRequestForHead: vi.fn().mockResolvedValue(null),
    };
    const featureService = {
      get: vi.fn().mockResolvedValue({
        id: "feature-1",
        projectId: "project-1",
        milestoneId: "milestone-completed",
        featureKey: "F-001",
        headRevision: { title: "Counter UI" },
      }),
    };
    const db = {
      query: {
        milestonesTable: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({
              id: "milestone-completed",
              position: 1,
              status: "completed",
              title: "Milestone 1",
              projectId: "project-1",
            })
            .mockResolvedValueOnce(null),
        },
      },
    };
    const service = makeService({ db, featureService, githubService });

    const branchPlan = await service.resolveDeliveryBranchPlan(
      "user-1",
      "sandbox-run-12345678",
      {
        owner: "acme",
        name: "repo",
        repoUrl: "https://github.com/acme/repo",
        defaultBranch: "main",
      } as never,
      "feature-1",
      "github_pat_secret",
    );

    expect(branchPlan.cloneBranchName).toBe("main");
    expect(branchPlan.targetBranchName).toBe("quayboard/fix/f-001/sandbox-");
    expect(branchPlan.pullRequestTitle).toBe("Fix F-001: Counter UI");
  });

  it("prunes older and non-succeeded workspace snapshots for a feature", async () => {
    const deletePath = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "run-newest",
        featureId: "feature-1",
        status: "succeeded",
        workspaceArchivePath: "/tmp/quayboard-artifacts/run-newest/workspace",
        completedAt: new Date("2026-04-04T00:00:00.000Z"),
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
      },
      {
        id: "run-older",
        featureId: "feature-1",
        status: "succeeded",
        workspaceArchivePath: "/tmp/quayboard-artifacts/run-older/workspace",
        completedAt: new Date("2026-04-03T00:00:00.000Z"),
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
      },
      {
        id: "run-failed",
        featureId: "feature-1",
        status: "failed",
        workspaceArchivePath: "/tmp/quayboard-artifacts/run-failed/workspace",
        completedAt: new Date("2026-04-02T00:00:00.000Z"),
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
    ]);
    const service = makeService({
      artifactStorageService: {
        deletePath,
      },
      db: {
        query: {
          sandboxRunsTable: {
            findMany,
          },
        },
      },
    });
    service.updateRunState = vi.fn().mockResolvedValue(undefined);

    await service.pruneWorkspaceSnapshots("feature-1");

    expect(deletePath).toHaveBeenCalledTimes(2);
    expect(service.updateRunState).toHaveBeenCalledWith("run-older", {
      workspaceArchivePath: null,
    });
    expect(service.updateRunState).toHaveBeenCalledWith("run-failed", {
      workspaceArchivePath: null,
    });
  });

  it("reconciles stale running runs and removes managed containers on startup", async () => {
    const removeContainer = vi.fn().mockResolvedValue(undefined);
    const pruneManagedResources = vi.fn().mockResolvedValue(undefined);
    const pruneRunDirectories = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      artifactStorageService: {
        pruneRunDirectories,
      },
      db: {
        query: {
          sandboxRunsTable: {
            findMany: vi.fn()
              .mockResolvedValueOnce([
                {
                  id: "run-1",
                  status: "running",
                  createdAt: new Date("2026-04-04T00:00:00.000Z"),
                },
              ])
              .mockResolvedValueOnce([
                {
                  id: "run-1",
                  status: "running",
                  createdAt: new Date("2026-04-04T00:00:00.000Z"),
                },
                {
                  id: "run-2",
                  status: "succeeded",
                  createdAt: new Date("2026-04-03T00:00:00.000Z"),
                },
              ]),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      },
      dockerService: {
        listManagedContainers: vi.fn().mockResolvedValue([
          {
            ID: "container-1",
            Labels:
              "quayboard.managed=true,quayboard.workspace=/tmp/quayboard-run-stale/workspace",
          },
        ]),
        pruneManagedResources,
        removeContainer,
      },
    });
    service.appendEvent = vi.fn().mockResolvedValue(undefined);
    service.cleanupTempWorkspaces = vi.fn().mockResolvedValue(undefined);
    service.pruneWorkspaceSnapshots = vi.fn().mockResolvedValue(undefined);
    service.updateRunState = vi.fn().mockResolvedValue(undefined);

    await service.reconcileRuntimeState();

    expect(removeContainer).toHaveBeenCalledWith("container-1", {
      dockerHost: null,
      force: true,
    });
    expect(service.updateRunState).toHaveBeenCalledWith("run-1", {
      status: "cancelled",
      outcome: "cancelled",
      cancellationReason:
        "The API restarted before this sandbox run finished, so the run was cancelled.",
      completedAt: expect.any(Date),
      containerId: null,
    });
    expect(service.cleanupTempWorkspaces).toHaveBeenCalledWith([
      "/tmp/quayboard-run-stale/workspace",
    ]);
    expect(pruneRunDirectories).toHaveBeenCalledWith(["run-1"]);
    expect(service.pruneWorkspaceSnapshots).toHaveBeenCalled();
    expect(pruneManagedResources).toHaveBeenCalledWith({
      dockerHost: null,
    });
  });

  it("exports approved feature user and architecture docs into the target repository", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "qb-doc-export-"));
    tempDirs.push(tempDir);

    const service = makeService({
      db: {
        query: {
          projectsTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: "project-1",
              name: "Demo Project",
              ownerUserId: "user-1",
            }),
          },
          onePagersTable: {
            findFirst: vi.fn().mockResolvedValue({
              markdown: "# Overview\n\nProject summary.",
            }),
          },
          milestonesTable: {
            findMany: vi.fn().mockResolvedValue([
              { id: "milestone-2", position: 2, title: "Polish" },
              { id: "milestone-1", position: 1, title: "Foundations" },
            ]),
          },
          milestoneDesignDocsTable: {
            findMany: vi.fn().mockResolvedValue([
              { milestoneId: "milestone-2", markdown: "# Milestone 2\n\nPolish work." },
              { milestoneId: "milestone-1", markdown: "# Milestone 1\n\nFoundations work." },
            ]),
          },
        },
      },
      featureService: {
        list: vi.fn().mockResolvedValue({
          features: [
            {
              id: "feature-2",
              featureKey: "F-002",
              milestoneId: "milestone-2",
              milestoneTitle: "Polish",
              headRevision: { title: "Checkout Polish" },
            },
            {
              id: "feature-1",
              featureKey: "F-001",
              milestoneId: "milestone-1",
              milestoneTitle: "Foundations",
              headRevision: { title: "Auth Setup" },
            },
            {
              id: "feature-3",
              featureKey: "F-003",
              milestoneId: "milestone-1",
              milestoneTitle: "Foundations",
              headRevision: { title: "Draft Docs" },
            },
          ],
        }),
      },
      featureWorkstreamService: {
        getTracks: vi.fn().mockImplementation(async (_ownerUserId: string, featureId: string) => {
          if (featureId === "feature-1") {
            return {
              tracks: {
                userDocs: {
                  status: "approved",
                  headRevision: {
                    title: "Auth Setup User Documentation",
                    markdown: "# Auth Docs\n\nHow to use auth.",
                  },
                },
                archDocs: {
                  status: "approved",
                  headRevision: {
                    title: "Auth Setup Architecture Documentation",
                    markdown: "# Auth Architecture\n\nHow auth is wired.",
                  },
                },
              },
            };
          }

          if (featureId === "feature-2") {
            return {
              tracks: {
                userDocs: {
                  status: "approved",
                  headRevision: {
                    title: "Checkout Polish User Documentation",
                    markdown: "# Checkout Docs\n\nCheckout flow.",
                  },
                },
                archDocs: {
                  status: "approved",
                  headRevision: {
                    title: "Checkout Polish Architecture Documentation",
                    markdown: "# Checkout Architecture\n\nCheckout boundaries.",
                  },
                },
              },
            };
          }

          return {
            tracks: {
              userDocs: {
                status: "draft",
                headRevision: {
                  title: "Draft User Docs",
                  markdown: "# Draft",
                },
              },
              archDocs: {
                status: "draft",
                headRevision: {
                  title: "Draft Architecture Docs",
                  markdown: "# Draft",
                },
              },
            },
          };
        }),
      },
    });

    await service.writeQuayboardDocs("project-1", tempDir);

    const rootIndex = await readFile(path.join(tempDir, "docs/quayboard/README.md"), "utf8");
    const userIndex = await readFile(path.join(tempDir, "docs/quayboard/user/README.md"), "utf8");
    const archIndex = await readFile(
      path.join(tempDir, "docs/quayboard/architecture/README.md"),
      "utf8",
    );
    const userFiles = await readdir(path.join(tempDir, "docs/quayboard/user"));
    const archFiles = await readdir(path.join(tempDir, "docs/quayboard/architecture"));

    expect(rootIndex).toContain("- [User Docs](user/README.md)");
    expect(rootIndex).toContain("- [Architecture Docs](architecture/README.md)");
    expect(rootIndex).toContain("- [Milestone 1: Foundations](milestones/milestone-1.md)");
    expect(rootIndex).toContain("- [Milestone 2: Polish](milestones/milestone-2.md)");

    expect(userIndex).toContain("milestone-1-f-001-user-docs.md");
    expect(userIndex).toContain("milestone-2-f-002-user-docs.md");
    expect(userIndex).not.toContain("F-003");
    expect(archIndex).toContain("milestone-1-f-001-architecture.md");
    expect(archIndex).toContain("milestone-2-f-002-architecture.md");
    expect(archIndex).not.toContain("F-003");

    expect(userFiles.sort()).toEqual([
      "README.md",
      "milestone-1-f-001-user-docs.md",
      "milestone-2-f-002-user-docs.md",
    ]);
    expect(archFiles.sort()).toEqual([
      "README.md",
      "milestone-1-f-001-architecture.md",
      "milestone-2-f-002-architecture.md",
    ]);

    await expect(
      readFile(path.join(tempDir, "docs/quayboard/user/milestone-1-f-001-user-docs.md"), "utf8"),
    ).resolves.toContain("# Auth Docs");
    await expect(
      readFile(
        path.join(tempDir, "docs/quayboard/architecture/milestone-2-f-002-architecture.md"),
        "utf8",
      ),
    ).resolves.toContain("# Checkout Architecture");
  });

});
