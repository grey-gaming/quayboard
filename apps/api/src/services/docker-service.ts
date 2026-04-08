import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const dockerCommandTimeoutMs = 5_000;
const containerCommandTimeoutMs = 60_000;
const containerWaitTimeoutMs = 15 * 60_000;
const imageBuildTimeoutMs = 30 * 60_000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const localSandboxImage = {
  contextPath: path.join(repoRoot, "docker", "agent-sandbox"),
  dockerfilePath: path.join(repoRoot, "docker", "agent-sandbox", "Dockerfile"),
  image: "quayboard-agent-sandbox:latest",
} as const;

type DockerCommandOptions = {
  dockerHost?: string | null;
  timeoutMs?: number;
};

type CreateManagedContainerInput = {
  artifactDir: string;
  command?: string[];
  cpuLimit: number;
  dockerHost?: string | null;
  env?: Record<string, string>;
  image: string;
  labels: Record<string, string>;
  memoryMb: number;
  name?: string;
  networkMode?: "bridge" | "host" | "none";
  networkDisabled?: boolean;
  workspaceDir: string;
};

type ListManagedContainersInput = {
  dockerHost?: string | null;
  projectId?: string;
};

type PruneDockerResourcesInput = {
  dockerHost?: string | null;
  maxBuildCacheSpace?: string;
  minFreeSpace?: string;
};

const createDockerWaitTimeoutError = (containerId: string, timeoutMs: number) =>
  Object.assign(
    new Error(
      `Sandbox container ${containerId} did not exit within ${Math.round(timeoutMs / 60_000)} minutes.`,
    ),
    {
      code: "docker_wait_timeout" as const,
      containerId,
      timeoutMs,
    },
  );

const resolveContainerUser = () => {
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  const gid = typeof process.getgid === "function" ? process.getgid() : null;

  if (typeof uid !== "number" || typeof gid !== "number") {
    return null;
  }

  return `${uid}:${gid}`;
};

export const createDockerService = (dockerHost: string | null) => {
  const buildEnv = (overrideDockerHost?: string | null) =>
    overrideDockerHost ?? dockerHost
      ? { ...process.env, DOCKER_HOST: overrideDockerHost ?? dockerHost ?? undefined }
      : process.env;
  const runDockerCommand = async (
    args: string[],
    options: DockerCommandOptions = {},
  ) =>
    execFileAsync("docker", args, {
      env: buildEnv(options.dockerHost),
      timeout: options.timeoutMs ?? dockerCommandTimeoutMs,
    });
  const resolveLocalImageBuild = (image: string) =>
    image === localSandboxImage.image && existsSync(localSandboxImage.dockerfilePath)
      ? localSandboxImage
      : null;
  const getLatestFileMtimeMs = (rootPath: string): number => {
    const stack = [rootPath];
    let latest = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || !existsSync(current)) {
        continue;
      }

      const stats = statSync(current);
      latest = Math.max(latest, stats.mtimeMs);

      if (stats.isDirectory()) {
        for (const entry of readdirSync(current)) {
          stack.push(path.join(current, entry));
        }
      }
    }

    return latest;
  };
  const getImageCreatedAtMs = async (image: string, overrideDockerHost?: string | null) => {
    const result = await runDockerCommand(
      ["image", "inspect", image, "--format", "{{.Created}}"],
      {
        dockerHost: overrideDockerHost,
      },
    );
    const createdAtMs = Date.parse(result.stdout.trim());

    return Number.isNaN(createdAtMs) ? 0 : createdAtMs;
  };
  const materializeImage = async (image: string, overrideDockerHost?: string | null) => {
    const localBuild = resolveLocalImageBuild(image);

    try {
      await runDockerCommand(["image", "inspect", image], {
        dockerHost: overrideDockerHost,
      });

      if (localBuild) {
        const [imageCreatedAtMs, sourceMtimeMs] = await Promise.all([
          getImageCreatedAtMs(image, overrideDockerHost),
          Promise.resolve(getLatestFileMtimeMs(localBuild.contextPath)),
        ]);

        if (sourceMtimeMs <= imageCreatedAtMs) {
          return;
        }

        await runDockerCommand(
          [
            "build",
            "--tag",
            image,
            "--file",
            localBuild.dockerfilePath,
            localBuild.contextPath,
          ],
          {
            dockerHost: overrideDockerHost,
            timeoutMs: imageBuildTimeoutMs,
          },
        );
        return;
      }

      return;
    } catch {
      if (localBuild) {
        await runDockerCommand(
          [
            "build",
            "--tag",
            image,
            "--file",
            localBuild.dockerfilePath,
            localBuild.contextPath,
          ],
          {
            dockerHost: overrideDockerHost,
            timeoutMs: imageBuildTimeoutMs,
          },
        );
        return;
      }

      await runDockerCommand(["pull", image], {
        dockerHost: overrideDockerHost,
        timeoutMs: containerCommandTimeoutMs,
      });
    }
  };

  return {
    async checkAvailability(overrideDockerHost?: string | null) {
      try {
        await runDockerCommand(["version"], { dockerHost: overrideDockerHost });
        return { ok: true, message: "Docker daemon is reachable." };
      } catch {
        return { ok: false, message: "Docker daemon is unavailable." };
      }
    },

    async verifySandboxImage(image = "alpine:3.20", overrideDockerHost?: string | null) {
      try {
        await materializeImage(image, overrideDockerHost);
      } catch {
        return {
          ok: false,
          message: resolveLocalImageBuild(image)
            ? `Sandbox image build failed for ${image}. Make sure Docker can build images from docker/agent-sandbox/Dockerfile, then retry verification.`
            : `Sandbox image pull failed for ${image}. Make sure Docker can pull images, then retry verification.`,
        };
      }

      try {
        await runDockerCommand(["run", "--rm", "--pull=never", image, "true"], {
          dockerHost: overrideDockerHost,
        });

        return {
          ok: true,
          message: "Sandbox container startup succeeded.",
        };
      } catch {
        return {
          ok: false,
          message: `Sandbox startup failed for ${image}. Make sure Docker can start containers, then retry verification.`,
        };
      }
    },

    async ensureImage(image: string, overrideDockerHost?: string | null) {
      await materializeImage(image, overrideDockerHost);
    },

    async createManagedContainer(input: CreateManagedContainerInput) {
      const args = ["create", "--pull=never"];
      const containerUser = resolveContainerUser();

      if (input.name) {
        args.push("--name", input.name);
      }

      if (containerUser) {
        args.push("--user", containerUser);
      }

      args.push("--label", "quayboard.managed=true");
      args.push("--label", `quayboard.workspace=${input.workspaceDir}`);

      for (const [key, value] of Object.entries(input.labels)) {
        args.push("--label", `${key}=${value}`);
      }

      for (const [key, value] of Object.entries(input.env ?? {})) {
        args.push("--env", `${key}=${value}`);
      }

      args.push("--env", "QB_ARTIFACT_DIR=/run/artifacts");
      args.push("--mount", `type=bind,src=${input.workspaceDir},dst=/workspace`);
      args.push("--mount", `type=bind,src=${input.artifactDir},dst=/run/artifacts`);

      if (input.networkMode !== "host") {
        args.push("--add-host", "host.docker.internal:host-gateway");
      }

      args.push("--cpus", String(input.cpuLimit));
      args.push("--memory", `${Math.max(128, input.memoryMb)}m`);

      if (input.networkMode === "host") {
        args.push("--network", "host");
      } else if (input.networkMode === "none" || input.networkDisabled) {
        args.push("--network", "none");
      }

      args.push(input.image);

      if (input.command?.length) {
        args.push(...input.command);
      }

      const result = await runDockerCommand(args, {
        dockerHost: input.dockerHost,
        timeoutMs: containerCommandTimeoutMs,
      });

      return result.stdout.trim();
    },

    async startContainer(containerId: string, overrideDockerHost?: string | null) {
      await runDockerCommand(["start", containerId], {
        dockerHost: overrideDockerHost,
        timeoutMs: containerCommandTimeoutMs,
      });
    },

    async waitForContainer(
      containerId: string,
      overrideDockerHost?: string | null,
      timeoutMs = containerWaitTimeoutMs,
    ) {
      let result;
      try {
        result = await runDockerCommand(["wait", containerId], {
          dockerHost: overrideDockerHost,
          timeoutMs,
        });
      } catch (error) {
        const record = error as { code?: string; killed?: boolean; signal?: string } | undefined;
        const timedOut =
          record?.code === "ETIMEDOUT" ||
          record?.killed === true ||
          record?.signal === "SIGTERM";

        if (timedOut) {
          throw createDockerWaitTimeoutError(containerId, timeoutMs);
        }

        throw error;
      }

      return Number.parseInt(result.stdout.trim(), 10);
    },

    async readLogs(containerId: string, overrideDockerHost?: string | null) {
      const result = await runDockerCommand(["logs", containerId], {
        dockerHost: overrideDockerHost,
        timeoutMs: containerCommandTimeoutMs,
      });

      return [result.stdout, result.stderr].filter(Boolean).join("\n");
    },

    async stopContainer(containerId: string, overrideDockerHost?: string | null) {
      await runDockerCommand(["stop", containerId], {
        dockerHost: overrideDockerHost,
        timeoutMs: containerCommandTimeoutMs,
      });
    },

    async removeContainer(
      containerId: string,
      options: { dockerHost?: string | null; force?: boolean } = {},
    ) {
      await runDockerCommand(
        options.force ? ["rm", "--force", containerId] : ["rm", containerId],
        {
          dockerHost: options.dockerHost,
          timeoutMs: containerCommandTimeoutMs,
        },
      );
    },

    async listManagedContainers(input: ListManagedContainersInput = {}) {
      const args = ["ps", "-a", "--filter", "label=quayboard.managed=true"];

      if (input.projectId) {
        args.push("--filter", `label=quayboard.project_id=${input.projectId}`);
      }

      args.push("--format", "{{json .}}");

      const result = await runDockerCommand(args, {
        dockerHost: input.dockerHost,
        timeoutMs: containerCommandTimeoutMs,
      });

      return result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, string>);
    },

    async pruneManagedResources(input: PruneDockerResourcesInput = {}) {
      await runDockerCommand(
        ["container", "prune", "--force", "--filter", "label=quayboard.managed=true"],
        {
          dockerHost: input.dockerHost,
          timeoutMs: containerCommandTimeoutMs,
        },
      ).catch(() => undefined);

      await runDockerCommand(["image", "prune", "--force"], {
        dockerHost: input.dockerHost,
        timeoutMs: containerCommandTimeoutMs,
      }).catch(() => undefined);

      await runDockerCommand(
        [
          "builder",
          "prune",
          "--force",
          "--max-used-space",
          input.maxBuildCacheSpace ?? "6gb",
          "--min-free-space",
          input.minFreeSpace ?? "4gb",
        ],
        {
          dockerHost: input.dockerHost,
          timeoutMs: imageBuildTimeoutMs,
        },
      ).catch(() => undefined);
    },
  };
};

export type DockerService = ReturnType<typeof createDockerService>;
