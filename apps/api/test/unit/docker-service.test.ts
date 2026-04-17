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

    const expectedUser =
      typeof process.getuid === "function" && typeof process.getgid === "function"
        ? `${process.getuid()}:${process.getgid()}`
        : null;

    expect(execFileMock.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(["create", "--pull=never", "--network", "host"]),
    );
    if (expectedUser) {
      expect(execFileMock.mock.calls[0]?.[1]).toEqual(
        expect.arrayContaining(["--user", expectedUser]),
      );
    }
    expect(execFileMock.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        "--env",
        "QB_ARTIFACT_DIR=/workspace/.quayboard-artifacts",
        "--env",
        "HOME=/run/artifacts/home",
        "--env",
        "XDG_CONFIG_HOME=/run/artifacts/home/.config",
        "--env",
        "XDG_CACHE_HOME=/run/artifacts/home/.cache",
        "--env",
        "XDG_DATA_HOME=/run/artifacts/home/.local/share",
        "--mount",
        "type=bind,src=/tmp/artifacts,dst=/run/artifacts",
        "--mount",
        "type=bind,src=/tmp/artifacts,dst=/workspace/.quayboard-artifacts",
      ]),
    );
    expect(execFileMock.mock.calls[0]?.[1]).not.toContain(
      "type=bind,src=/tmp/artifacts,dst=/root/.local/share/opencode/tool-output",
    );
    expect(execFileMock.mock.calls[0]?.[1]).not.toContain("host.docker.internal:host-gateway");
    expect(execFileMock.mock.calls[0]?.[2]).toMatchObject({
      maxBuffer: 16 * 1024 * 1024,
    });
  });

  it("falls back to tailed logs when full container logs exceed the output buffer", async () => {
    execFileMock
      .mockImplementationOnce(
        (
          _file: string,
          _args: string[],
          _options: Record<string, unknown>,
          callback: (error: Error | null, stdout?: string, stderr?: string) => void,
        ) => {
          callback(
            Object.assign(new Error("stdout maxBuffer length exceeded"), {
              code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
            }),
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
          callback(null, { stdout: "last log lines", stderr: "" });
        },
      );

    const service = createDockerService(null);
    const logs = await service.readLogs("container-123");

    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      ["logs", "container-123"],
      ["logs", "--tail", "5000", "container-123"],
    ]);
    expect(execFileMock.mock.calls[0]?.[2]).toMatchObject({
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(logs).toContain("Full docker logs exceeded");
    expect(logs).toContain("last log lines");
  });

  it("raises a structured timeout error when waiting for a container exceeds the limit", async () => {
    execFileMock.mockImplementationOnce(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
      ) => {
        callback(
          Object.assign(new Error("timed out"), {
            code: "ETIMEDOUT",
            killed: true,
            signal: "SIGTERM",
          }),
        );
      },
    );

    const service = createDockerService(null);

    await expect(service.waitForContainer("container-123")).rejects.toMatchObject({
      code: "docker_wait_timeout",
      containerId: "container-123",
      timeoutMs: 15 * 60_000,
    });
  });

  it("prunes managed containers, dangling images, and build cache using bounded thresholds", async () => {
    execFileMock.mockImplementation(
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
    await service.pruneManagedResources();

    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      ["container", "prune", "--force", "--filter", "label=quayboard.managed=true"],
      ["image", "prune", "--force"],
      [
        "builder",
        "prune",
        "--force",
        "--max-used-space",
        "6gb",
        "--min-free-space",
        "4gb",
      ],
    ]);
  });
});
