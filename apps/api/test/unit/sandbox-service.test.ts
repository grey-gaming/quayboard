import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { createSandboxService } from "../../src/services/sandbox-service.js";

const makeExecError = (message: string, stderr = "") => {
  const error = new Error(message) as Error & { stderr?: string; stdout?: string };
  error.stderr = stderr;
  error.stdout = "";
  return error;
};

const makeService = () =>
  createSandboxService({
    artifactStorageService: {} as never,
    contextPackService: {} as never,
    db: {} as never,
    dockerService: {} as never,
    executionSettingsService: {} as never,
    featureService: {} as never,
    featureWorkstreamService: {} as never,
    githubService: {} as never,
    llmRuntimeDefaults: {
      ollamaHost: "http://127.0.0.1:11434/v1",
      openAiBaseUrl: "https://api.openai.com/v1",
    },
    secretService: {} as never,
    sseHub: {} as never,
    taskPlanningService: {} as never,
  });

describe("sandbox service", () => {
  beforeEach(() => {
    execFileMock.mockReset();
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
});
