import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const bashEnvPath = fileURLToPath(
  new URL("../../../../docker/agent-sandbox/qb_bash_env.sh", import.meta.url),
);

describe("agent sandbox bash environment", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it("kills background jobs when a non-interactive bash command exits", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "qb-bash-env-"));
    tempDirs.push(tempDir);
    const pidFile = path.join(tempDir, "sleep.pid");

    await execFileAsync("bash", [
      "-lc",
      `BASH_ENV='${bashEnvPath}' bash -c 'sleep 30 & echo $! > "${pidFile}"'`,
    ]);

    const pid = (await readFile(pidFile, "utf8")).trim();
    const result = await execFileAsync("bash", [
      "-lc",
      `kill -0 ${pid} 2>/dev/null && printf alive || printf dead`,
    ]);

    expect(result.stdout).toBe("dead");
  });
});
