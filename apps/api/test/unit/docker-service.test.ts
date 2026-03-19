import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { createDockerService } from "../../src/services/docker-service.js";

describe("docker service", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("pulls the sandbox image when it is missing locally", async () => {
    execFileMock
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(new Error("missing image"));
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

    const service = createDockerService(null);
    const result = await service.verifySandboxImage();

    expect(result).toEqual({
      ok: true,
      message: "Sandbox container startup succeeded.",
    });
    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      ["image", "inspect", "alpine:3.20"],
      ["pull", "alpine:3.20"],
      ["run", "--rm", "--pull=never", "alpine:3.20", "true"],
    ]);
  });

  it("returns a specific error when the image pull fails", async () => {
    execFileMock
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(new Error("missing image"));
        },
      )
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(new Error("pull failed"));
        },
      );

    const service = createDockerService(null);
    const result = await service.verifySandboxImage();

    expect(result).toEqual({
      ok: false,
      message:
        "Sandbox image pull failed for alpine:3.20. Make sure Docker can pull images, then retry verification.",
    });
  });

  it("returns a specific error when the container cannot start", async () => {
    execFileMock
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(null, { stdout: "", stderr: "" });
        },
      )
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
        ) => {
          callback(new Error("run failed"));
        },
      );

    const service = createDockerService(null);
    const result = await service.verifySandboxImage();

    expect(result).toEqual({
      ok: false,
      message:
        "Sandbox startup failed for alpine:3.20. Make sure Docker can start containers, then retry verification.",
    });
  });
});
