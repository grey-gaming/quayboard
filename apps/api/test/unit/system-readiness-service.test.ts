import { describe, expect, it, vi } from "vitest";

import { createSystemReadinessService } from "../../src/services/system-readiness-service.js";

describe("system readiness service", () => {
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
});
