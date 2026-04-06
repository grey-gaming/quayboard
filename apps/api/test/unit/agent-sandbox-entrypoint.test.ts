import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const entrypointPath = fileURLToPath(
  new URL("../../../../docker/agent-sandbox/qb_entrypoint.sh", import.meta.url),
);

describe("agent sandbox entrypoint prompt", () => {
  it("lets implement runs update relevant docs and adjacent boundaries without inviting scope creep", async () => {
    const content = await readFile(entrypointPath, "utf8");

    expect(content).toContain("Implementation mode:");
    expect(content).toContain("small adjacent integration update");
    expect(content).toContain("add or update relevant user-facing documentation or architecture documentation");
    expect(content).toContain("Do not rely on model memory for package names or versions.");
    expect(content).toContain("query the relevant package registry or package-manager metadata first");
    expect(content).toContain("latest stable non-prerelease release");
    expect(content).toContain("Do not invent new features, speculative behavior, or unrelated refactors.");
  });

  it("keeps verify guidance compatible with narrow doc and boundary follow-through", async () => {
    const content = await readFile(entrypointPath, "utf8");

    expect(content).toContain("Verification mode:");
    expect(content).toContain("small adjacent code or documentation touch-ups");
    expect(content).toContain("If version lookup or package download fails, stop and report the failure instead of guessing a version.");
    expect(content).toContain("prefer a safer current alternative when feasible");
    expect(content).toContain("Do not expand product scope, add unrelated features, or start broader cleanup work.");
  });
});
