import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const createArtifactStorageService = (artifactStoragePath: string) => ({
  async ensureRunDir(runId: string) {
    const runDir = path.join(artifactStoragePath, runId);
    await mkdir(runDir, { recursive: true });
    return runDir;
  },

  async writeRunArtifact(
    runId: string,
    name: string,
    content: Buffer | string,
    contentType: string,
  ) {
    const runDir = await this.ensureRunDir(runId);
    const artifactPath = path.join(runDir, name);
    await writeFile(artifactPath, content);
    const info = await stat(artifactPath);

    return {
      contentType,
      path: artifactPath,
      sizeBytes: info.size,
    };
  },

  async copyRunArtifact(runId: string, sourcePath: string, name?: string) {
    const runDir = await this.ensureRunDir(runId);
    const targetPath = path.join(runDir, name ?? path.basename(sourcePath));
    await cp(sourcePath, targetPath, { force: true });
    const info = await stat(targetPath);

    return {
      contentType: "application/octet-stream",
      path: targetPath,
      sizeBytes: info.size,
    };
  },

  async snapshotWorkspace(runId: string, sourcePath: string) {
    const runDir = await this.ensureRunDir(runId);
    const targetPath = path.join(runDir, "workspace");
    await cp(sourcePath, targetPath, { recursive: true, force: true });
    return targetPath;
  },

  async restoreWorkspaceSnapshot(snapshotPath: string, targetPath: string) {
    await cp(snapshotPath, targetPath, { recursive: true, force: true });
  },

  async readArtifact(storagePath: string) {
    return readFile(storagePath);
  },
});

export type ArtifactStorageService = ReturnType<
  typeof createArtifactStorageService
>;
