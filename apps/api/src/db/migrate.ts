import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { readDatabaseUrl } from "../config.js";

export const runMigrations = async () => {
  const databaseUrl = readDatabaseUrl();
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void runMigrations();
}
