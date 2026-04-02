import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const wrapperPath = fileURLToPath(
  new URL("../../../../docker/agent-sandbox/qb_bash_wrapper.sh", import.meta.url),
);

describe("agent sandbox bash wrapper", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it("kills orphaned background processes when the wrapped bash command exits", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "qb-bash-wrapper-"));
    tempDirs.push(tempDir);
    const pidFile = path.join(tempDir, "sleep.pid");

    await execFileAsync("sh", [
      wrapperPath,
      "-lc",
      `sleep 30 & echo $! > "${pidFile}"`,
    ], {
      env: {
        ...process.env,
        REAL_BASH: process.env.SHELL ?? "/bin/bash",
      },
    });

    const pid = (await readFile(pidFile, "utf8")).trim();
    const result = await execFileAsync("bash", [
      "-lc",
      `kill -0 ${pid} 2>/dev/null && printf alive || printf dead`,
    ]);

    expect(result.stdout).toBe("dead");
  });
});
