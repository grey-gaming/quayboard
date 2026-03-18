import postgres from "postgres";

import { readIntegrationDatabaseUrl } from "../../src/config.js";

const escapeIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const toDatabaseName = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName) {
    throw new Error("Integration database URL must include a database name.");
  }

  return databaseName;
};

const toAdminDatabaseUrl = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
};

export const integrationDatabaseUrl = readIntegrationDatabaseUrl();

export const ensureIntegrationDatabaseExists = async () => {
  const databaseName = toDatabaseName(integrationDatabaseUrl);
  const sql = postgres(toAdminDatabaseUrl(integrationDatabaseUrl), { max: 1 });

  try {
    const result = await sql<{ exists: boolean }[]>`
      select exists(
        select 1 from pg_database where datname = ${databaseName}
      ) as "exists"
    `;

    if (!result[0]?.exists) {
      await sql.unsafe(`create database ${escapeIdentifier(databaseName)}`);
    }
  } finally {
    await sql.end();
  }
};
