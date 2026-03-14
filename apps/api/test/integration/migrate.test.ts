import { describe, expect, it } from "vitest";

import { runMigrations } from "../../src/db/migrate.js";

describe("runMigrations", () => {
  it("runs successfully more than once", async () => {
    expect(process.env.DATABASE_URL).toBeTruthy();

    await runMigrations();
    await runMigrations();
  });
});
