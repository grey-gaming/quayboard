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

  it("builds the Quayboard sandbox image locally when it is missing", async () => {
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
      );

    const service = createDockerService(null);
    await service.ensureImage("quayboard-agent-sandbox:latest");

    expect(execFileMock.mock.calls).toHaveLength(2);
    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      "image",
      "inspect",
      "quayboard-agent-sandbox:latest",
    ]);
    expect(execFileMock.mock.calls[1]?.[1]).toEqual(
      expect.arrayContaining([
        "build",
        "--tag",
        "quayboard-agent-sandbox:latest",
        "--file",
      ]),
    );
    expect(execFileMock.mock.calls[1]?.[1]?.at(-1)).toContain("docker/agent-sandbox");
  });

  it("rebuilds the Quayboard sandbox image when local sandbox files are newer", async () => {
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
          callback(null, { stdout: "1970-01-01T00:00:00.000Z\n", stderr: "" });
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
    await service.ensureImage("quayboard-agent-sandbox:latest");

    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      ["image", "inspect", "quayboard-agent-sandbox:latest"],
      ["image", "inspect", "quayboard-agent-sandbox:latest", "--format", "{{.Created}}"],
      expect.arrayContaining([
        "build",
        "--tag",
        "quayboard-agent-sandbox:latest",
        "--file",
      ]),
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

  it("uses host networking without host-gateway alias when requested", async () => {
    execFileMock.mockImplementationOnce(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
      ) => {
        callback(null, { stdout: "container-id\n", stderr: "" });
      },
    );

    const service = createDockerService(null);
    await service.createManagedContainer({
      artifactDir: "/tmp/artifacts",
      cpuLimit: 1,
      image: "quayboard-agent-sandbox:latest",
      labels: {
        "quayboard.project_id": "project-1",
      },
      memoryMb: 1024,
      networkMode: "host",
      workspaceDir: "/tmp/workspace",
    });

    expect(execFileMock.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(["create", "--pull=never", "--network", "host"]),
    );
    expect(execFileMock.mock.calls[0]?.[1]).not.toContain("host.docker.internal:host-gateway");
  });
});
