import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSystemReadinessService } from "../../src/services/system-readiness-service.js";

describe("system readiness service", () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdPaths.splice(0).map((path) => rm(path, { force: true, recursive: true })),
    );
  });

  it("fails database and docker checks when they time out", async () => {
    vi.useFakeTimers();

    const service = createSystemReadinessService({
      artifactStoragePath: "/tmp",
      databaseCheck: () => new Promise<boolean>(() => undefined),
      dockerService: {
        checkAvailability: () =>
          new Promise<{ ok: boolean; message: string }>(() => undefined),
        verifySandboxImage: vi.fn(),
      },
      providers: ["ollama"],
      secretsKeyPresent: true,
    });

    const readinessPromise = service.getReadiness();
    await vi.advanceTimersByTimeAsync(5_000);
    const readiness = await readinessPromise;

    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "database",
          status: "fail",
          message:
            "Database connection failed. Check DATABASE_URL, confirm Postgres is running, then reload this page.",
        }),
        expect.objectContaining({
          key: "docker",
          status: "fail",
          message:
            "Docker daemon is unavailable. Start Docker and confirm the docker CLI can reach the configured daemon, then reload this page.",
        }),
      ]),
    );

    vi.useRealTimers();
  });

  it("fails the artifact storage check when the path is not writable", async () => {
    const artifactPath = await mkdtemp(join(tmpdir(), "qb-readiness-"));
    createdPaths.push(artifactPath);
    await chmod(artifactPath, 0o555);

    const service = createSystemReadinessService({
      artifactStoragePath: artifactPath,
      databaseCheck: async () => true,
      dockerService: {
        checkAvailability: async () => ({ ok: true, message: "Docker is available." }),
        verifySandboxImage: vi.fn(),
      },
      providers: ["ollama"],
      secretsKeyPresent: true,
    });

    const readiness = await service.getReadiness();

    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "artifact_storage",
          status: "fail",
          message:
            "Artifact storage path is not writable. Check ARTIFACT_STORAGE_PATH and directory permissions, then reload this page.",
        }),
      ]),
    );
  });
});
