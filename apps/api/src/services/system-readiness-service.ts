import { access } from "node:fs/promises";

import type { DockerService } from "./docker-service.js";

const readinessCheckTimeoutMs = 5_000;

const withTimeout = async <T>(promise: Promise<T>, fallback: T) => {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), readinessCheckTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

export const createSystemReadinessService = (input: {
  artifactStoragePath: string;
  databaseCheck: () => Promise<boolean>;
  dockerService: DockerService;
  providers: string[];
  secretsKeyPresent: boolean;
}) => ({
  async getReadiness() {
    const [databaseReady, dockerReady, artifactWritable] = await Promise.all([
      withTimeout(input.databaseCheck(), false),
      withTimeout(
        input.dockerService.checkAvailability(),
        {
          ok: false,
          message: "Docker readiness check timed out.",
        },
      ),
      access(input.artifactStoragePath).then(
        () => true,
        () => false,
      ),
    ]);

    return {
      checks: [
        {
          key: "database",
          label: "Database",
          status: databaseReady ? "pass" : "fail",
          message: databaseReady
            ? "Database connection succeeded."
            : "Database connection failed. Check DATABASE_URL, confirm Postgres is running, then reload this page.",
        },
        {
          key: "encryption_key",
          label: "Encryption Key",
          status: input.secretsKeyPresent ? "pass" : "fail",
          message: input.secretsKeyPresent
            ? "Secrets encryption key is configured."
            : "SECRETS_ENCRYPTION_KEY is missing. Add it to .env, restart the API, then reload this page.",
        },
        {
          key: "docker",
          label: "Docker",
          status: dockerReady.ok ? "pass" : "fail",
          message: dockerReady.ok
            ? dockerReady.message
            : "Docker daemon is unavailable. Start Docker and confirm the docker CLI can reach the configured daemon, then reload this page.",
        },
        {
          key: "artifact_storage",
          label: "Artifact Storage",
          status: artifactWritable ? "pass" : "fail",
          message: artifactWritable
            ? "Artifact storage path is writable."
            : "Artifact storage path is not writable. Check ARTIFACT_STORAGE_PATH and directory permissions, then reload this page.",
        },
        {
          key: "providers",
          label: "Provider Adapters",
          status: input.providers.length > 0 ? "pass" : "fail",
          message:
            input.providers.length > 0
              ? `Enabled providers: ${input.providers.join(", ")}.`
              : "No provider adapters are enabled. Review the first-install guide, enable at least one provider, then reload this page.",
        },
      ],
    };
  },
});

export type SystemReadinessService = ReturnType<
  typeof createSystemReadinessService
>;
