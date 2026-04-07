import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createArtifactStorageService } from "../../src/services/artifact-storage-service.js";

describe("artifact storage service", () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdPaths.splice(0).map((targetPath) => rm(targetPath, { force: true, recursive: true })),
    );
  });

  it("recreates the base artifact directory before writing a run artifact", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "qb-artifacts-"));
    createdPaths.push(rootPath);

    const storagePath = path.join(rootPath, "nested", "artifacts");
    const service = createArtifactStorageService(storagePath);

    const artifact = await service.writeRunArtifact(
      "run-1",
      "container.log",
      "hello",
      "text/plain",
    );

    expect(artifact.path).toBe(path.join(storagePath, "run-1", "container.log"));
    await expect(service.readArtifact(artifact.path)).resolves.toEqual(Buffer.from("hello"));
  });

  it("prunes artifact directories that no longer map to sandbox runs", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "qb-artifacts-"));
    createdPaths.push(rootPath);

    const storagePath = path.join(rootPath, "nested", "artifacts");
    await mkdir(path.join(storagePath, "run-keep"), { recursive: true });
    await writeFile(path.join(storagePath, "run-keep", "container.log"), "keep");
    await mkdir(path.join(storagePath, "run-drop"), { recursive: true });
    await writeFile(path.join(storagePath, "run-drop", "container.log"), "drop");

    const service = createArtifactStorageService(storagePath);

    await service.pruneRunDirectories(["run-keep"]);

    await expect(access(path.join(storagePath, "run-keep", "container.log"))).resolves.toBeUndefined();
    await expect(access(path.join(storagePath, "run-drop"))).rejects.toThrow();
  });
});
