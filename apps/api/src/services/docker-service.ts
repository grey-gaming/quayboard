import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const dockerCommandTimeoutMs = 5_000;

export const createDockerService = (dockerHost: string | null) => {
  const baseEnv = dockerHost ? { ...process.env, DOCKER_HOST: dockerHost } : process.env;
  const runDockerCommand = async (args: string[]) =>
    execFileAsync("docker", args, {
      env: baseEnv,
      timeout: dockerCommandTimeoutMs,
    });

  return {
    async checkAvailability() {
      try {
        await runDockerCommand(["version"]);
        return { ok: true, message: "Docker daemon is reachable." };
      } catch {
        return { ok: false, message: "Docker daemon is unavailable." };
      }
    },

    async verifySandboxImage(image = "alpine:3.20") {
      try {
        await runDockerCommand(["image", "inspect", image]);
      } catch {
        try {
          await runDockerCommand(["pull", image]);
        } catch {
          return {
            ok: false,
            message: `Sandbox image pull failed for ${image}. Make sure Docker can pull images, then retry verification.`,
          };
        }
      }

      try {
        await runDockerCommand(["run", "--rm", "--pull=never", image, "true"]);

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
  };
};

export type DockerService = ReturnType<typeof createDockerService>;
