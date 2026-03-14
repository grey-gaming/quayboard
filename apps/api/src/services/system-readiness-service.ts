import { access } from "node:fs/promises";

import type { DockerService } from "./docker-service.js";

export const createSystemReadinessService = (input: {
  artifactStoragePath: string;
  databaseCheck: () => Promise<boolean>;
  dockerService: DockerService;
  providers: string[];
  secretsKeyPresent: boolean;
}) => ({
  async getReadiness() {
    const [databaseReady, dockerReady, artifactWritable] = await Promise.all([
      input.databaseCheck(),
      input.dockerService.checkAvailability(),
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
            : "Database connection failed.",
        },
        {
          key: "encryption_key",
          label: "Encryption Key",
          status: input.secretsKeyPresent ? "pass" : "fail",
          message: input.secretsKeyPresent
            ? "Secrets encryption key is configured."
            : "Set SECRETS_ENCRYPTION_KEY before continuing.",
        },
        {
          key: "docker",
          label: "Docker",
          status: dockerReady.ok ? "pass" : "fail",
          message: dockerReady.message,
        },
        {
          key: "artifact_storage",
          label: "Artifact Storage",
          status: artifactWritable ? "pass" : "fail",
          message: artifactWritable
            ? "Artifact storage path is writable."
            : "Artifact storage path is not writable.",
        },
        {
          key: "providers",
          label: "Provider Adapters",
          status: input.providers.length > 0 ? "pass" : "fail",
          message:
            input.providers.length > 0
              ? `Enabled providers: ${input.providers.join(", ")}.`
              : "No provider adapters are enabled.",
        },
      ],
    };
  },
});

export type SystemReadinessService = ReturnType<
  typeof createSystemReadinessService
>;
