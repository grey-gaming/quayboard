import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const createDockerService = (dockerHost: string | null) => {
  const baseEnv = dockerHost ? { ...process.env, DOCKER_HOST: dockerHost } : process.env;

  return {
    async checkAvailability() {
      try {
        await execFileAsync("docker", ["version"], { env: baseEnv });
        return { ok: true, message: "Docker daemon is reachable." };
      } catch {
        return { ok: false, message: "Docker daemon is unavailable." };
      }
    },

    async verifySandboxImage(image = "alpine:3.20") {
      try {
        await execFileAsync(
          "docker",
          ["run", "--rm", "--pull=never", image, "true"],
          { env: baseEnv },
        );

        return {
          ok: true,
          message: "Sandbox container startup succeeded.",
        };
      } catch {
        return {
          ok: false,
          message:
            "Sandbox startup failed. Make sure Docker is running and the sandbox base image is available locally.",
        };
      }
    },
  };
};

export type DockerService = ReturnType<typeof createDockerService>;
